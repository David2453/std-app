package com.example.chatbackend;

import com.example.chatbackend.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    
    // toate mesajele ordonate dupa timestamp
    List<ChatMessage> findAllByOrderByTimestampAsc();
    
    // cele mai recente n mesaje 
    @Query("SELECT m FROM ChatMessage m ORDER BY m.timestamp DESC LIMIT :limit")
    List<ChatMessage> findRecentMessages(@Param("limit") int limit);
    
    // alternativa pentru jpa daca limit nu functioneaza
    List<ChatMessage> findTop50ByOrderByTimestampDesc();
}