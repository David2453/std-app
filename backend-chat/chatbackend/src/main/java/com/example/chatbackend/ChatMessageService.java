package com.example.chatbackend;

import com.example.chatbackend.ChatMessageDTO;
import com.example.chatbackend.ChatMessage;
import com.example.chatbackend.ChatMessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ChatMessageService {
    
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    
    private final ChatMessageRepository chatMessageRepository;
    
    @Autowired
    public ChatMessageService(ChatMessageRepository chatMessageRepository) {
        this.chatMessageRepository = chatMessageRepository;
    }
    
    public ChatMessage saveMessage(String username, String content) {
        ChatMessage message = new ChatMessage(username, content);
        return chatMessageRepository.save(message);
    }
    
    public List<ChatMessageDTO> getAllMessages() {
        return chatMessageRepository.findAllByOrderByTimestampAsc().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }
    
    public List<ChatMessage> getRecentMessages(int limit) {
        try {
            return chatMessageRepository.findRecentMessages(limit);
        } catch (Exception e) {
            return chatMessageRepository.findTop50ByOrderByTimestampDesc();
        }
    }
    
    private ChatMessageDTO convertToDTO(ChatMessage message) {
        return new ChatMessageDTO(
                message.getId(),
                message.getUsername(),
                message.getContent(),
                message.getTimestamp().format(FORMATTER)
        );
    }
}