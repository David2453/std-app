package com.example.chatbackend;

import com.example.chatbackend.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    
    // Găsește toate mesajele ordonate după timestamp (cronologic)
    List<ChatMessage> findAllByOrderByTimestampAsc();
    
    // Găsește cele mai recente n mesaje ordonate după timestamp
    @Query("SELECT m FROM ChatMessage m ORDER BY m.timestamp DESC LIMIT :limit")
    List<ChatMessage> findRecentMessages(@Param("limit") int limit);
    
    // Alternativă pentru JPA standard dacă LIMIT nu funcționează în unele versiuni
    List<ChatMessage> findTop50ByOrderByTimestampDesc();
}