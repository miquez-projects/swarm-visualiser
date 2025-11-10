import React, { useMemo } from 'react';
import { Box, Typography, Paper, IconButton, Tooltip, Chip } from '@mui/material';
import { ContentCopy, Room } from '@mui/icons-material';
import { parseVenueMentions } from './venueParser';
import PropTypes from 'prop-types';

function ChatMessage({ role, content, timestamp, onVenueClick }) {
  const isUser = role === 'user';

  const parsedContent = useMemo(
    () => parseVenueMentions(content),
    [content]
  );

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
        <Box sx={{ whiteSpace: 'pre-wrap' }}>
          {parsedContent.map((part, i) =>
            part.type === 'text' ? (
              <span key={i}>{part.content}</span>
            ) : (
              <Chip
                key={i}
                icon={<Room fontSize="small" />}
                label={part.venueName}
                size="small"
                clickable
                onClick={() => onVenueClick?.(part)}
                sx={{
                  mx: 0.5,
                  my: 0.25,
                  cursor: 'pointer',
                  bgcolor: 'primary.light',
                  color: 'primary.contrastText',
                  '&:hover': {
                    bgcolor: 'primary.main',
                    transform: 'scale(1.05)'
                  },
                  transition: 'all 0.2s ease'
                }}
              />
            )
          )}
        </Box>

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

ChatMessage.propTypes = {
  role: PropTypes.string.isRequired,
  content: PropTypes.string.isRequired,
  timestamp: PropTypes.string,
  onVenueClick: PropTypes.func
};

export default ChatMessage;
