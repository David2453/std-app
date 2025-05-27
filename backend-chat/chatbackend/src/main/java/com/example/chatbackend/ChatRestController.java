package com.example.chatbackend;

import com.example.chatbackend.ChatMessageDTO;
import com.example.chatbackend.ChatMessageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
@CrossOrigin(origins = "*") // Pentru dezvoltare locală, în producție specifică doar originile necesare
public class ChatRestController {
    
    private final ChatMessageService chatMessageService;
    
    @Autowired
    public ChatRestController(ChatMessageService chatMessageService) {
        this.chatMessageService = chatMessageService;
    }
    
    @GetMapping("/messages")
    public List<ChatMessageDTO> getAllMessages() {
        return chatMessageService.getAllMessages();
    }
}