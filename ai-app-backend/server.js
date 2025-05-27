require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { BlobServiceClient } = require('@azure/storage-blob');
const { TextAnalyticsClient, AzureKeyCredential } = require('@azure/ai-text-analytics');
const sql = require('mssql');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configurare Multer pentru upload fișiere
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Configurare Azure Blob Storage
const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
);
const containerClient = blobServiceClient.getContainerClient(
    process.env.AZURE_STORAGE_CONTAINER_NAME
);

// Configurare Azure Text Analytics
const textAnalyticsClient = new TextAnalyticsClient(
    process.env.AZURE_LANGUAGE_ENDPOINT,
    new AzureKeyCredential(process.env.AZURE_LANGUAGE_KEY)
);

// Configurare SQL Database
const sqlConfig = {
    server: process.env.SQL_SERVER,
    database: process.env.SQL_DATABASE,
    user: process.env.SQL_USERNAME,
    password: process.env.SQL_PASSWORD,
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

// Verificare conexiuni la pornire
async function initializeServices() {
    try {
        console.log('🔧 Inițializez serviciile Azure...');
        
        // Test Azure Blob Storage
        await containerClient.createIfNotExists();
        console.log('✅ Azure Blob Storage conectat');
        
        // Test SQL Database
        await sql.connect(sqlConfig);
        console.log('✅ SQL Database conectat');
        
        // Creează tabelul dacă nu există
        await createTablesIfNotExists();
        
        console.log('🚀 Toate serviciile sunt gata!');
    } catch (error) {
        console.error('❌ Eroare la inițializare:', error.message);
        process.exit(1);
    }
}

// Creează tabelul pentru metadate
async function createTablesIfNotExists() {
    const createTableQuery = `
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='FileProcessing' AND xtype='U')
        CREATE TABLE FileProcessing (
            id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
            fileName NVARCHAR(255) NOT NULL,
            originalName NVARCHAR(255) NOT NULL,
            blobUrl NVARCHAR(500) NOT NULL,
            fileSize INT NOT NULL,
            uploadTimestamp DATETIME2 DEFAULT GETDATE(),
            processingStatus NVARCHAR(50) DEFAULT 'pending',
            extractedEntities NVARCHAR(MAX),
            errorMessage NVARCHAR(MAX),
            processedTimestamp DATETIME2
        )
    `;
    
    const request = new sql.Request();
    await request.query(createTableQuery);
    console.log('✅ Tabel FileProcessing creat/verificat');
}

// RUTE API

// Ruta de test
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Backend AI App funcționează!',
        timestamp: new Date().toISOString()
    });
});

// Upload și procesare fișier
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Niciun fișier încărcat' });
        }

        const fileId = uuidv4();
        const fileName = `${fileId}-${req.file.originalname}`;
        
        console.log(`📁 Procesez fișierul: ${req.file.originalname}`);

        // 1. Upload în Azure Blob Storage
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        await blockBlobClient.uploadData(req.file.buffer);
        
        const blobUrl = blockBlobClient.url;
        console.log('✅ Fișier încărcat în Blob Storage');

        // 2. Salvează metadatele în SQL
        const request = new sql.Request();
        await request
            .input('id', sql.UniqueIdentifier, fileId)
            .input('fileName', sql.NVarChar, fileName)
            .input('originalName', sql.NVarChar, req.file.originalname)
            .input('blobUrl', sql.NVarChar, blobUrl)
            .input('fileSize', sql.Int, req.file.size)
            .query(`
                INSERT INTO FileProcessing 
                (id, fileName, originalName, blobUrl, fileSize, processingStatus)
                VALUES (@id, @fileName, @originalName, @blobUrl, @fileSize, 'processing')
            `);

        console.log('✅ Metadate salvate în SQL');

        // 3. Procesează textul pentru Entity Extraction (dacă e fișier text)
        let extractedEntities = null;
        try {
            if (req.file.mimetype.startsWith('text/') || 
                req.file.originalname.toLowerCase().endsWith('.txt')) {
                
                const textContent = req.file.buffer.toString('utf-8');
                console.log('🔍 Analizez textul pentru entități...');
                
                const entityResults = await textAnalyticsClient.recognizeEntities([textContent]);
                
                if (entityResults.length > 0 && !entityResults[0].error) {
                    extractedEntities = {
                        entities: entityResults[0].entities.map(entity => ({
                            text: entity.text,
                            category: entity.category,
                            subcategory: entity.subCategory,
                            confidence: entity.confidenceScore
                        }))
                    };
                }
                
                console.log(`✅ Găsite ${extractedEntities?.entities?.length || 0} entități`);
            }
        } catch (aiError) {
            console.error('⚠️ Eroare la procesarea AI:', aiError.message);
        }

        // 4. Update rezultatul în SQL
        await request
            .input('fileId', sql.UniqueIdentifier, fileId)
            .input('entities', sql.NVarChar, extractedEntities ? JSON.stringify(extractedEntities) : null)
            .input('status', sql.NVarChar, 'completed')
            .query(`
                UPDATE FileProcessing 
                SET extractedEntities = @entities, 
                    processingStatus = @status,
                    processedTimestamp = GETDATE()
                WHERE id = @fileId
            `);

        res.json({
            success: true,
            fileId: fileId,
            fileName: req.file.originalname,
            blobUrl: blobUrl,
            fileSize: req.file.size,
            extractedEntities: extractedEntities,
            message: 'Fișier procesat cu succes!'
        });

    } catch (error) {
        console.error('❌ Eroare la procesare:', error);
        res.status(500).json({ 
            error: 'Eroare la procesarea fișierului',
            details: error.message 
        });
    }
});

// Obține istoricul fișierelor
app.get('/api/history', async (req, res) => {
    try {
        const request = new sql.Request();
        const result = await request.query(`
            SELECT 
                id,
                originalName,
                fileSize,
                uploadTimestamp,
                processingStatus,
                extractedEntities,
                processedTimestamp
            FROM FileProcessing 
            ORDER BY uploadTimestamp DESC
        `);

        const history = result.recordset.map(record => ({
            ...record,
            extractedEntities: record.extractedEntities ? 
                JSON.parse(record.extractedEntities) : null
        }));

        res.json({ history });

    } catch (error) {
        console.error('❌ Eroare la obținerea istoricului:', error);
        res.status(500).json({ 
            error: 'Eroare la obținerea istoricului',
            details: error.message 
        });
    }
});

// Obține detalii fișier specific
app.get('/api/file/:id', async (req, res) => {
    try {
        const request = new sql.Request();
        const result = await request
            .input('fileId', sql.UniqueIdentifier, req.params.id)
            .query(`
                SELECT * FROM FileProcessing 
                WHERE id = @fileId
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Fișier negăsit' });
        }

        const fileData = result.recordset[0];
        if (fileData.extractedEntities) {
            fileData.extractedEntities = JSON.parse(fileData.extractedEntities);
        }

        res.json(fileData);

    } catch (error) {
        console.error('❌ Eroare la obținerea fișierului:', error);
        res.status(500).json({ 
            error: 'Eroare la obținerea fișierului',
            details: error.message 
        });
    }
});


// ADAUGĂ ACESTE RUTE ÎN server.js după rutele existente

// Obține toate entitățile de un anumit tip
app.get('/api/entities/:type', async (req, res) => {
    try {
        const entityType = req.params.type; // "Person", "Organization", "Location", etc.
        
        const request = new sql.Request();
        const result = await request.query(`
            SELECT 
                originalName,
                extractedEntities,
                uploadTimestamp
            FROM FileProcessing 
            WHERE extractedEntities IS NOT NULL
            ORDER BY uploadTimestamp DESC
        `);

        const allEntities = [];
        
        result.recordset.forEach(record => {
            if (record.extractedEntities) {
                const entities = JSON.parse(record.extractedEntities);
                if (entities.entities) {
                    entities.entities
                        .filter(entity => entity.category === entityType)
                        .forEach(entity => {
                            allEntities.push({
                                text: entity.text,
                                confidence: entity.confidence,
                                document: record.originalName,
                                date: record.uploadTimestamp
                            });
                        });
                }
            }
        });

        res.json({ 
            type: entityType,
            count: allEntities.length,
            entities: allEntities 
        });

    } catch (error) {
        console.error('Eroare la obținerea entităților:', error);
        res.status(500).json({ error: 'Eroare la obținerea entităților' });
    }
});

// Obține statistici generale
app.get('/api/stats', async (req, res) => {
    try {
        const request = new sql.Request();
        const result = await request.query(`
            SELECT 
                COUNT(*) as totalFiles,
                SUM(fileSize) as totalSize,
                extractedEntities
            FROM FileProcessing 
            WHERE processingStatus = 'completed'
        `);

        const stats = {
            totalFiles: 0,
            totalSize: 0,
            entitiesByType: {},
            totalEntities: 0
        };

        result.recordset.forEach(record => {
            stats.totalFiles = record.totalFiles;
            stats.totalSize = record.totalSize;
            
            if (record.extractedEntities) {
                const entities = JSON.parse(record.extractedEntities);
                if (entities.entities) {
                    entities.entities.forEach(entity => {
                        stats.entitiesByType[entity.category] = 
                            (stats.entitiesByType[entity.category] || 0) + 1;
                        stats.totalEntities++;
                    });
                }
            }
        });

        res.json(stats);

    } catch (error) {
        console.error('Eroare la obținerea statisticilor:', error);
        res.status(500).json({ error: 'Eroare la obținerea statisticilor' });
    }
});

// Export toate datele într-un format simplu
app.get('/api/export', async (req, res) => {
    try {
        const request = new sql.Request();
        const result = await request.query(`
            SELECT * FROM FileProcessing 
            WHERE extractedEntities IS NOT NULL
            ORDER BY uploadTimestamp DESC
        `);

        const exportData = result.recordset.map(record => {
            const data = {
                fileName: record.originalName,
                uploadDate: record.uploadTimestamp,
                fileSize: record.fileSize,
                entities: []
            };

            if (record.extractedEntities) {
                const entities = JSON.parse(record.extractedEntities);
                if (entities.entities) {
                    data.entities = entities.entities.map(entity => ({
                        text: entity.text,
                        type: entity.category,
                        confidence: Math.round(entity.confidence * 100)
                    }));
                }
            }

            return data;
        });

        res.json({
            exportDate: new Date().toISOString(),
            totalDocuments: exportData.length,
            data: exportData
        });

    } catch (error) {
        console.error('Eroare la export:', error);
        res.status(500).json({ error: 'Eroare la export' });
    }
});

// Caută entități cu text specific
app.get('/api/search/:searchTerm', async (req, res) => {
    try {
        const searchTerm = req.params.searchTerm.toLowerCase();
        
        const request = new sql.Request();
        const result = await request.query(`
            SELECT 
                originalName,
                extractedEntities,
                uploadTimestamp
            FROM FileProcessing 
            WHERE extractedEntities IS NOT NULL
        `);

        const matches = [];
        
        result.recordset.forEach(record => {
            if (record.extractedEntities) {
                const entities = JSON.parse(record.extractedEntities);
                if (entities.entities) {
                    entities.entities.forEach(entity => {
                        if (entity.text.toLowerCase().includes(searchTerm)) {
                            matches.push({
                                text: entity.text,
                                category: entity.category,
                                confidence: entity.confidence,
                                document: record.originalName,
                                date: record.uploadTimestamp
                            });
                        }
                    });
                }
            }
        });

        res.json({
            searchTerm: searchTerm,
            matches: matches.length,
            results: matches
        });

    } catch (error) {
        console.error('Eroare la căutare:', error);
        res.status(500).json({ error: 'Eroare la căutare' });
    }
});

// Pornește serverul
initializeServices().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Backend pornit pe portul ${PORT}`);
        console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
    });
}).catch(error => {
    console.error('❌ Eroare la pornirea serverului:', error);
    process.exit(1);
});