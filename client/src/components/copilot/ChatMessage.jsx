import React from 'react';
import { Box, Typography, Paper, IconButton, Tooltip } from '@mui/material';
import { ContentCopy } from '@mui/icons-material';

function ChatMessage({ role, content, timestamp }) {
  const isUser = role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        mb: 2
      }}
    >
      <Paper
        elevation={1}
        sx={{
          maxWidth: '80%',
          p: 2,
          bgcolor: isUser ? 'primary.main' : 'grey.100',
          color: isUser ? 'primary.contrastText' : 'text.primary',
          borderRadius: 2,
          position: 'relative',
          '&:hover .copy-button': {
            opacity: 1
          }
        }}
      >
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
          {content}
        </Typography>

        {timestamp && (
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 0.5,
              opacity: 0.7,
              fontSize: '0.7rem'
            }}
          >
            {new Date(timestamp).toLocaleTimeString()}
          </Typography>
        )}

        {!isUser && (
          <IconButton
            className="copy-button"
            size="small"
            onClick={handleCopy}
            sx={{
              position: 'absolute',
              top: 4,
              right: 4,
              opacity: 0,
              transition: 'opacity 0.2s',
              bgcolor: 'background.paper'
            }}
          >
            <Tooltip title="Copy">
              <ContentCopy fontSize="small" />
            </Tooltip>
          </IconButton>
        )}
      </Paper>
    </Box>
  );
}

export default ChatMessage;
