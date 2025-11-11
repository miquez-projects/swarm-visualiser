import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Fab,
  Paper,
  CircularProgress,
  Typography,
  Slide,
  Alert
} from '@mui/material';
import { Chat } from '@mui/icons-material';
import ChatHeader from './ChatHeader';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { sendCopilotMessage } from '../../services/api';
import {
  loadMessages,
  saveMessages,
  clearMessages,
  loadCopilotState,
  saveCopilotState
} from '../../utils/copilotStorage';

function CopilotChat({ token, onVenueClick }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const handleVenueClick = (venue) => {
    // Close copilot to show map
    setIsOpen(false);
    // Call parent handler
    onVenueClick?.(venue);
  };

  // Load state and messages on mount
  useEffect(() => {
    const savedState = loadCopilotState();
    setIsOpen(savedState.isOpen || false);
    setIsExpanded(savedState.isExpanded || false);

    const savedMessages = loadMessages();
    setMessages(savedMessages);
  }, []);

  // Save state when it changes
  useEffect(() => {
    saveCopilotState({ isOpen, isExpanded });
  }, [isOpen, isExpanded]);

  // Save messages when they change
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (message) => {
    setError(null);

    // Add user message immediately
    const userMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Send to API
      const response = await sendCopilotMessage(message, messages, token);

      // Backend returns all conversation turns from this request
      // This includes: user message, function calls with thought signatures, and final response
      if (response.messages && Array.isArray(response.messages)) {
        // Filter out the user message (already added) and function-only messages
        // Only show messages with actual text content to the user
        const displayMessages = response.messages.filter(msg => {
          // Skip user messages (we already added it)
          if (msg.role === 'user') return false;

          // For assistant messages, only show if there's text content
          if (msg.role === 'assistant' || msg.role === 'model') {
            return msg.text && msg.text.trim() && msg.text !== '[Function call]';
          }

          return true;
        });

        // Append filtered messages to conversation history
        setMessages(prev => [...prev, ...displayMessages]);
      } else {
        // Fallback for old format (backwards compatibility)
        const aiMessage = {
          role: 'assistant',
          content: response.content,
          text: response.response,
          timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      // Check for specific error messages
      const errorMessage = err.response?.data?.error || err.message || '';
      if (errorMessage.includes('overloaded') || errorMessage.includes('503')) {
        setError('AI service is currently overloaded. Please try again in a moment.');
      } else {
        setError('Unable to reach AI service. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    if (window.confirm('Clear all chat history?')) {
      // Clear state first
      setMessages([]);
      // Clear localStorage
      clearMessages();
      // Force a re-render by clearing error state too
      setError(null);
    }
  };

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleMinimize = () => {
    setIsOpen(false);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleOpen = () => {
    setIsOpen(true);
  };

  // Chat panel dimensions
  const width = isExpanded ? 800 : 400;
  const height = 600;

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <Fab
          color="primary"
          onClick={handleOpen}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000
          }}
        >
          <Chat />
        </Fab>
      )}

      {/* Chat Panel */}
      <Slide direction="up" in={isOpen} mountOnEnter unmountOnExit>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: { xs: 'calc(100vw - 48px)', sm: width },
            height: { xs: 'calc(100vh - 48px)', sm: height },
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1300,
            maxWidth: '90vw'
          }}
        >
          {/* Header */}
          <ChatHeader
            onClose={handleClose}
            onMinimize={handleMinimize}
            onToggleExpand={handleToggleExpand}
            isExpanded={isExpanded}
            onClear={handleClear}
          />

          {/* Messages */}
          <Box
            sx={{
              flexGrow: 1,
              overflowY: 'auto',
              p: 2,
              bgcolor: 'background.default'
            }}
          >
            {messages.length === 0 && (
              <Box sx={{ textAlign: 'center', mt: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Ask me anything about your check-ins!
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Try: "Where did I last check in in Slovenia?"
                </Typography>
              </Box>
            )}

            {messages.map((msg, index) => (
              <ChatMessage
                key={index}
                role={msg.role}
                content={msg.text || msg.content} // Use text for display, fallback to content
                timestamp={msg.timestamp}
                onVenueClick={handleVenueClick}
              />
            ))}

            {isLoading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  Thinking...
                </Typography>
              </Box>
            )}

            {error && (
              <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <div ref={messagesEndRef} />
          </Box>

          {/* Input */}
          <ChatInput onSend={handleSendMessage} disabled={isLoading} />
        </Paper>
      </Slide>
    </>
  );
}

CopilotChat.propTypes = {
  token: PropTypes.string.isRequired,
  onVenueClick: PropTypes.func
};

export default CopilotChat;
