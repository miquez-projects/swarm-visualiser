import React, { useState } from 'react';
import { Box, TextField, IconButton } from '@mui/material';
import { PaperPlaneTilt } from '@phosphor-icons/react';

function ChatInput({ onSend, disabled }) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        p: 2,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        gap: 1
      }}
    >
      <TextField
        fullWidth
        multiline
        maxRows={4}
        placeholder="Ask about your check-ins..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        size="small"
        autoFocus
      />
      <IconButton
        type="submit"
        color="primary"
        disabled={disabled || !message.trim()}
        sx={{ alignSelf: 'flex-end' }}
      >
        <PaperPlaneTilt size={20} />
      </IconButton>
    </Box>
  );
}

export default ChatInput;
