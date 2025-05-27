package com.example.chatbackend;

public class ChatMessageDTO {
    private Long id;
    private String username;
    private String content;
    private String timestamp;
    
    // Constructor gol
    public ChatMessageDTO() {
    }
    
    // Constructor cu parametri
    public ChatMessageDTO(String username, String content, String timestamp) {
        this.username = username;
        this.content = content;
        this.timestamp = timestamp;
    }
    
    // Constructor cu id și restul parametrilor
    public ChatMessageDTO(Long id, String username, String content, String timestamp) {
        this.id = id;
        this.username = username;
        this.content = content;
        this.timestamp = timestamp;
    }
    
    // Getteri și setteri
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public String getUsername() {
        return username;
    }
    
    public void setUsername(String username) {
        this.username = username;
    }
    
    public String getContent() {
        return content;
    }
    
    public void setContent(String content) {
        this.content = content;
    }
    
    public String getTimestamp() {
        return timestamp;
    }
    
    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }
}