package com.example.chatbackend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    
    @Value("${cors.allowed-origins:http://localhost:4200,http://localhost:90,http://localhost:30080}")
    private String[] allowedOrigins;
    
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Endpoint pentru SockJS (compatibil cu browsere vechi)
        registry.addEndpoint("/chat")
                .setAllowedOriginPatterns("*") // Pentru dezvoltare locală, în producție specifică doar originile necesare
                .withSockJS();
        
        // Endpoint pentru WebSocket nativ
        registry.addEndpoint("/chat")
                .setAllowedOriginPatterns("*");
    }
    
    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic");
        registry.setApplicationDestinationPrefixes("/app");
    }
}