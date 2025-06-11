import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
//import { environment } from '../environments/environment';

interface FileResult {
  success: boolean;
  fileId: string;
  fileName: string;
  fileSize: number;
  blobUrl: string;
  extractedEntities?: {
    entities: Array<{
      text: string;
      category: string;
      subcategory?: string;
      confidence: number;
    }>;
  };
  message: string;
}

interface HistoryItem {
  id: string;
  originalName: string;
  fileSize: number;
  uploadTimestamp: string;
  processingStatus: string;
  extractedEntities?: {
    entities: Array<{
      text: string;
      category: string;
      confidence: number;
    }>;
  };
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  template: `
    <div class="container">
      <header>
        <h1>🤖 AI Document Analyzer</h1>
        <p>Upload documents for automatic entity extraction</p>
      </header>

      <!-- Upload Section -->
      <div class="upload-section">
        <div class="upload-area" 
             [class.drag-over]="isDragOver"
             (dragover)="onDragOver($event)"
             (dragleave)="onDragLeave($event)"
             (drop)="onDrop($event)"
             (click)="fileInput.click()">
          
          <div class="upload-content">
            <div class="upload-icon">📁</div>
            <h3>Drop files here or click to browse</h3>
            <p>Supports .txt, .doc, .docx files (max 10MB)</p>
          </div>
          
          <input #fileInput 
                 type="file" 
                 (change)="onFileSelected($event)"
                 accept=".txt,.doc,.docx"
                 style="display: none;">
        </div>

        <button class="btn-primary" 
                (click)="uploadFile()" 
                [disabled]="!selectedFile || isUploading">
          <span *ngIf="isUploading">⏳ Processing...</span>
          <span *ngIf="!isUploading">🚀 Analyze Document</span>
        </button>
      </div>

      <!-- Selected File Info -->
      <div *ngIf="selectedFile" class="file-info">
        <h4>📋 Selected File</h4>
        <p><strong>Name:</strong> {{selectedFile.name}}</p>
        <p><strong>Size:</strong> {{formatFileSize(selectedFile.size)}}</p>
        <p><strong>Type:</strong> {{selectedFile.type || 'Unknown'}}</p>
      </div>

      <!-- Results Section -->
      <div *ngIf="lastResult" class="results-section">
        <h3>✅ Analysis Results</h3>
        
        <div class="result-card">
          <h4>📄 {{lastResult.fileName}}</h4>
          <p><strong>Size:</strong> {{formatFileSize(lastResult.fileSize)}}</p>
          <p><strong>Status:</strong> <span class="status-success">Processed Successfully</span></p>
          
          <div *ngIf="lastResult.extractedEntities?.entities?.length; else noEntities">
            <h5>🎯 Found {{lastResult.extractedEntities!.entities!.length}} entities:</h5>
            <div class="entities-grid">
              <div *ngFor="let entity of lastResult.extractedEntities!.entities!" 
                   class="entity-tag"
                   [class]="'entity-' + entity.category.toLowerCase()">
                <strong>{{entity.text}}</strong>
                <small>{{entity.category}} ({{(entity.confidence * 100).toFixed(0)}}%)</small>
              </div>
            </div>
          </div>
          
          <ng-template #noEntities>
            <p>ℹ️ No entities detected in this document</p>
          </ng-template>
        </div>
      </div>

      <!-- Dashboard Controls -->
      <div class="dashboard-controls">
        <button class="btn-secondary" (click)="toggleDashboard()">
          <span *ngIf="!showDashboard">📊 Show Analytics Dashboard</span>
          <span *ngIf="showDashboard">❌ Hide Dashboard</span>
        </button>
        
        <button class="btn-secondary" (click)="exportData()">
          💾 Export All Data
        </button>
      </div>

      <!-- Dashboard Section -->
      <div *ngIf="showDashboard" class="dashboard-section">
        <h2>📊 Analytics Dashboard</h2>
        
        <!-- Stats Overview -->
        <div *ngIf="stats" class="stats-grid">
          <div class="stat-card">
            <h4>📄 Total Documents</h4>
            <span class="stat-number">{{stats.totalFiles}}</span>
          </div>
          
          <div class="stat-card">
            <h4>🎯 Total Entities</h4>
            <span class="stat-number">{{stats.totalEntities}}</span>
          </div>
          
          <div class="stat-card">
            <h4>💾 Total Size</h4>
            <span class="stat-number">{{formatFileSize(stats.totalSize)}}</span>
          </div>
          
          <div class="stat-card">
            <h4>📂 Entity Types</h4>
            <span class="stat-number">{{getObjectKeys(stats.entitiesByType).length}}</span>
          </div>
        </div>

        <!-- Entity Types Breakdown -->
        <div *ngIf="stats" class="entity-breakdown">
          <h3>🏷️ Entities by Type</h3>
          <div class="breakdown-grid">
            <div *ngFor="let item of getObjectKeys(stats.entitiesByType)" 
                 class="breakdown-item">
              <span class="entity-type">{{item}}</span>
              <span class="entity-count">{{stats.entitiesByType[item]}}</span>
            </div>
          </div>
        </div>

        <!-- Search Section -->
        <div class="search-section">
          <h3>🔍 Search Entities</h3>
          <div class="search-input-group">
            <input [(ngModel)]="searchTerm" 
                   placeholder="Search for people, companies, locations..."
                   class="search-input"
                   (keyup.enter)="searchEntities()">
            <button class="btn-primary search-btn" (click)="searchEntities()">Search</button>
          </div>
          
          <div *ngIf="searchResults" class="search-results">
            <h4>Found {{searchResults.matches}} matches for "{{searchResults.searchTerm}}"</h4>
            <div *ngFor="let result of searchResults.results" class="search-result-item">
              <strong>{{result.text}}</strong> 
              <span class="result-category">({{result.category}})</span>
              <span class="result-confidence">{{(result.confidence * 100).toFixed(0)}}%</span>
              <small class="result-document">in {{result.document}}</small>
            </div>
          </div>
        </div>

        <!-- Detailed Entity Lists -->
        <div class="detailed-entities">
          <h3>👥 All People Found</h3>
          <div *ngIf="entitiesByType['Person']" class="entity-list">
            <div *ngFor="let entity of entitiesByType['Person'].entities" 
                 class="entity-list-item">
              <strong>{{entity.text}}</strong>
              <small>{{(entity.confidence * 100).toFixed(0)}}% confidence - {{entity.document}}</small>
            </div>
          </div>

          <h3>🏢 All Organizations Found</h3>
          <div *ngIf="entitiesByType['Organization']" class="entity-list">
            <div *ngFor="let entity of entitiesByType['Organization'].entities" 
                 class="entity-list-item">
              <strong>{{entity.text}}</strong>
              <small>{{(entity.confidence * 100).toFixed(0)}}% confidence - {{entity.document}}</small>
            </div>
          </div>

          <h3>📍 All Locations Found</h3>
          <div *ngIf="entitiesByType['Location']" class="entity-list">
            <div *ngFor="let entity of entitiesByType['Location'].entities" 
                 class="entity-list-item">
              <strong>{{entity.text}}</strong>
              <small>{{(entity.confidence * 100).toFixed(0)}}% confidence - {{entity.document}}</small>
            </div>
          </div>
        </div>
      </div>

      <!-- History Section -->
      <div class="history-section">
        <div class="section-header">
          <h3>📚 Processing History</h3>
          <button class="btn-secondary" (click)="loadHistory()" [disabled]="isLoadingHistory">
            <span *ngIf="isLoadingHistory">⏳</span>
            <span *ngIf="!isLoadingHistory">🔄</span>
            Refresh
          </button>
        </div>

        <div *ngIf="history.length === 0 && !isLoadingHistory" class="empty-state">
          <p>📝 No documents processed yet. Upload your first document above!</p>
        </div>

        <div *ngFor="let item of history" class="history-item">
          <div class="item-header">
            <h4>📄 {{item.originalName}}</h4>
            <span class="timestamp">{{formatDate(item.uploadTimestamp)}}</span>
          </div>
          
          <div class="item-details">
            <span class="status" [class]="'status-' + item.processingStatus">
              {{item.processingStatus}}
            </span>
            <span class="size">{{formatFileSize(item.fileSize)}}</span>
            <span *ngIf="item.extractedEntities?.entities" class="entities-count">
              🎯 {{item.extractedEntities!.entities!.length}} entities
            </span>
          </div>

          <div *ngIf="item.extractedEntities?.entities?.length" class="item-entities">
            <div *ngFor="let entity of item.extractedEntities!.entities!.slice(0, 5)" 
                 class="entity-mini">
              {{entity.text}}
            </div>
            <span *ngIf="item.extractedEntities!.entities!.length > 5" class="more-entities">
              +{{item.extractedEntities!.entities!.length - 5}} more...
            </span>
          </div>
        </div>
      </div>

      <!-- Error Messages -->
      <div *ngIf="errorMessage" class="error-message">
        ❌ {{errorMessage}}
      </div>
    </div>
  `,
  styles: [`
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    header {
      text-align: center;
      margin-bottom: 30px;
    }

    header h1 {
      color: #2c3e50;
      margin-bottom: 5px;
    }

    header p {
      color: #7f8c8d;
      margin: 0;
    }

    .upload-section {
      margin-bottom: 30px;
    }

    .upload-area {
      border: 2px dashed #3498db;
      border-radius: 12px;
      padding: 40px;
      text-align: center;
      background-color: #f8f9fa;
      cursor: pointer;
      transition: all 0.3s ease;
      margin-bottom: 15px;
    }

    .upload-area:hover, .upload-area.drag-over {
      background-color: #e3f2fd;
      border-color: #2196f3;
    }

    .upload-content .upload-icon {
      font-size: 48px;
      margin-bottom: 15px;
    }

    .upload-content h3 {
      color: #2c3e50;
      margin-bottom: 5px;
    }

    .upload-content p {
      color: #7f8c8d;
      margin: 0;
    }

    .btn-primary, .btn-secondary {
      padding: 12px 24px;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.3s ease;
    }

    .btn-primary {
      background-color: #3498db;
      color: white;
      width: 100%;
    }

    .btn-primary:hover:not(:disabled) {
      background-color: #2980b9;
    }

    .btn-primary:disabled {
      background-color: #bdc3c7;
      cursor: not-allowed;
    }

    .btn-secondary {
      background-color: #ecf0f1;
      color: #2c3e50;
    }

    .btn-secondary:hover:not(:disabled) {
      background-color: #d5dbdb;
    }

    .file-info, .results-section {
      background-color: white;
      border: 1px solid #e1e8ed;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .file-info h4, .results-section h3 {
      margin-top: 0;
      color: #2c3e50;
    }

    .result-card {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 6px;
      border-left: 4px solid #27ae60;
    }

    .entities-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }

    .entity-tag {
      background-color: #3498db;
      color: white;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .entity-tag small {
      font-size: 11px;
      opacity: 0.9;
    }

    .entity-person { background-color: #e74c3c; }
    .entity-organization { background-color: #f39c12; }
    .entity-location { background-color: #27ae60; }
    .entity-datetime { background-color: #9b59b6; }

    /* DASHBOARD STYLES */
    .dashboard-controls {
      display: flex;
      gap: 10px;
      margin: 20px 0;
      justify-content: center;
    }

    .dashboard-section {
      background-color: white;
      border: 1px solid #e1e8ed;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }

    .dashboard-section h2 {
      color: #2c3e50;
      text-align: center;
      margin-bottom: 30px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }

    .stat-card h4 {
      margin: 0 0 10px 0;
      font-size: 14px;
      opacity: 0.9;
    }

    .stat-number {
      font-size: 32px;
      font-weight: bold;
      display: block;
    }

    .entity-breakdown {
      margin: 30px 0;
    }

    .entity-breakdown h3 {
      color: #2c3e50;
      margin-bottom: 15px;
    }

    .breakdown-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;
    }

    .breakdown-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: #f8f9fa;
      padding: 10px 15px;
      border-radius: 6px;
      border-left: 4px solid #3498db;
    }

    .entity-type {
      font-weight: 500;
      color: #2c3e50;
    }

    .entity-count {
      background-color: #3498db;
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
    }

    .search-section {
      margin: 30px 0;
    }

    .search-section h3 {
      color: #2c3e50;
      margin-bottom: 15px;
    }

    .search-input-group {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }

    .search-input {
      flex: 1;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 16px;
    }

    .search-btn {
      width: auto !important;
    }

    .search-results {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 6px;
      border-left: 4px solid #27ae60;
    }

    .search-results h4 {
      color: #2c3e50;
      margin-bottom: 15px;
    }

    .search-result-item {
      padding: 8px 0;
      border-bottom: 1px solid #e1e8ed;
    }

    .search-result-item:last-child {
      border-bottom: none;
    }

    .result-category {
      background-color: #e74c3c;
      color: white;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 11px;
      margin-left: 8px;
    }

    .result-confidence {
      background-color: #27ae60;
      color: white;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 11px;
      margin-left: 5px;
    }

    .result-document {
      color: #7f8c8d;
      font-style: italic;
      margin-left: 10px;
    }

    .detailed-entities {
      margin-top: 30px;
    }

    .detailed-entities h3 {
      color: #2c3e50;
      margin: 25px 0 15px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid #3498db;
    }

    .entity-list {
      display: grid;
      gap: 8px;
    }

    .entity-list-item {
      background-color: #f8f9fa;
      padding: 12px;
      border-radius: 6px;
      border-left: 3px solid #3498db;
    }

    .entity-list-item strong {
      color: #2c3e50;
      display: block;
      margin-bottom: 4px;
    }

    .entity-list-item small {
      color: #7f8c8d;
      font-size: 12px;
    }

    .history-section {
      background-color: white;
      border: 1px solid #e1e8ed;
      border-radius: 8px;
      padding: 20px;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .section-header h3 {
      margin: 0;
      color: #2c3e50;
    }

    .history-item {
      border: 1px solid #e1e8ed;
      border-radius: 6px;
      padding: 15px;
      margin-bottom: 10px;
      background-color: #f8f9fa;
    }

    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .item-header h4 {
      margin: 0;
      color: #2c3e50;
      font-size: 16px;
    }

    .timestamp {
      color: #7f8c8d;
      font-size: 12px;
    }

    .item-details {
      display: flex;
      gap: 15px;
      align-items: center;
      margin-bottom: 8px;
    }

    .status {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-completed { background-color: #d4edda; color: #155724; }
    .status-processing { background-color: #fff3cd; color: #856404; }
    .status-error { background-color: #f8d7da; color: #721c24; }

    .size, .entities-count {
      color: #7f8c8d;
      font-size: 12px;
    }

    .item-entities {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .entity-mini {
      background-color: #e9ecef;
      color: #495057;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 11px;
    }

    .more-entities {
      color: #7f8c8d;
      font-size: 11px;
      font-style: italic;
    }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: #7f8c8d;
    }

    .error-message {
      background-color: #f8d7da;
      color: #721c24;
      padding: 12px;
      border-radius: 6px;
      border: 1px solid #f5c6cb;
      margin-top: 20px;
    }

    .status-success {
      color: #27ae60;
      font-weight: 500;
    }
  `]
})
export class AppComponent {
  title = 'AI Document Analyzer';
  selectedFile: File | null = null;
  isUploading = false;
  isLoadingHistory = false;
  isDragOver = false;
  lastResult: FileResult | null = null;
  history: HistoryItem[] = [];
  errorMessage = '';

  // Dashboard properties
  showDashboard = false;
  stats: any = null;
  entitiesByType: any = {};
  isLoadingStats = false;
  searchTerm = '';
  searchResults: any = null;

  private apiUrl = '/api';
  constructor(private http: HttpClient) {
    this.loadHistory();
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.selectedFile = files[0];
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  uploadFile() {
    if (!this.selectedFile) return;

    this.isUploading = true;
    this.errorMessage = '';

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    this.http.post<FileResult>(`${this.apiUrl}/upload`, formData)
      .subscribe({
        next: (result) => {
          this.lastResult = result;
          this.isUploading = false;
          this.selectedFile = null;
          this.loadHistory(); // Refresh history
          if (this.showDashboard) {
            this.loadStats(); // Refresh dashboard if open
          }
        },
        error: (error) => {
          this.errorMessage = error.error?.error || 'Upload failed. Please try again.';
          this.isUploading = false;
        }
      });
  }

  loadHistory() {
    this.isLoadingHistory = true;
    
    this.http.get<{history: HistoryItem[]}>(`${this.apiUrl}/history`)
      .subscribe({
        next: (response) => {
          this.history = response.history;
          this.isLoadingHistory = false;
        },
        error: (error) => {
          console.error('Failed to load history:', error);
          this.isLoadingHistory = false;
        }
      });
  }

  // Dashboard methods
  loadStats() {
    this.isLoadingStats = true;
    
    this.http.get<any>(`${this.apiUrl}/stats`)
      .subscribe({
        next: (stats) => {
          this.stats = stats;
          this.isLoadingStats = false;
        },
        error: (error) => {
          console.error('Failed to load stats:', error);
          this.isLoadingStats = false;
        }
      });
  }

  loadEntitiesByType(type: string) {
    this.http.get<any>(`${this.apiUrl}/entities/${type}`)
      .subscribe({
        next: (result) => {
          this.entitiesByType[type] = result;
        },
        error: (error) => {
          console.error(`Failed to load ${type} entities:`, error);
        }
      });
  }

  toggleDashboard() {
    this.showDashboard = !this.showDashboard;
    if (this.showDashboard) {
      this.loadStats();
      this.loadEntitiesByType('Person');
      this.loadEntitiesByType('Organization');
      this.loadEntitiesByType('Location');
    }
  }

  exportData() {
    this.http.get<any>(`${this.apiUrl}/export`)
      .subscribe({
        next: (data) => {
          const blob = new Blob([JSON.stringify(data, null, 2)], 
            { type: 'application/json' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `ai-entities-export-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        },
        error: (error) => {
          console.error('Export failed:', error);
        }
      });
  }

  searchEntities() {
    if (!this.searchTerm.trim()) return;
    
    this.http.get<any>(`${this.apiUrl}/search/${this.searchTerm}`)
      .subscribe({
        next: (results) => {
          this.searchResults = results;
        },
        error: (error) => {
          console.error('Search failed:', error);
        }
      });
  }

  // Helper methods
  getObjectKeys(obj: any): string[] {
    return Object.keys(obj || {});
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('ro-RO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}