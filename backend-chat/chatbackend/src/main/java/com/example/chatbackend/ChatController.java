package com.example.chatbackend;

import com.example.chatbackend.ChatMessageDTO;
import com.example.chatbackend.ChatMessage;
import com.example.chatbackend.ChatMessageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Controller
public class ChatController {
    
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    
    private final ChatMessageService chatMessageService;
    private final SimpMessagingTemplate messagingTemplate;
    
    @Autowired
    public ChatController(ChatMessageService chatMessageService, SimpMessagingTemplate messagingTemplate) {
        this.chatMessageService = chatMessageService;
        this.messagingTemplate = messagingTemplate;
    }
    
    @MessageMapping("/send")
    @SendTo("/topic/messages")
    public ChatMessageDTO sendMessage(ChatMessageDTO messageDTO) {
        // salveaza mesajul in db
        ChatMessage savedMessage = chatMessageService.saveMessage(messageDTO.getUsername(), messageDTO.getContent());
        
        // returneaza dto
        return new ChatMessageDTO(
                savedMessage.getId(),
                savedMessage.getUsername(),
                savedMessage.getContent(),
                savedMessage.getTimestamp().format(FORMATTER)
        );
    }
    
    @MessageMapping("/history")
    @SendTo("/topic/messages")
    public List<ChatMessageDTO> getHistory() {
        // Obține istoricul mesajelor din baza de date
        List<ChatMessage> messages = chatMessageService.getRecentMessages(50);
        
        // Convertește mesajele în DTOs pentru a fi trimise înapoi la clienți
        return messages.stream()
            .map(message -> new ChatMessageDTO(
                message.getId(),
                message.getUsername(),
                message.getContent(),
                message.getTimestamp().format(FORMATTER)
            ))
            .collect(Collectors.toList());
    }
}