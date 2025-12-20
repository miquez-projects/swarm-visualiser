import React, { useMemo } from 'react';
import { Box, Typography, Paper, IconButton, Chip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Copy, MapPin } from '@phosphor-icons/react';
import { parseVenueMentions } from './venueParser';
import { overlayColors } from '../../theme';
import PropTypes from 'prop-types';

function ChatMessage({ role, content, timestamp, onVenueClick }) {
  const theme = useTheme();
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
        sx={{
          maxWidth: '80%',
          p: 2,
          bgcolor: isUser ? 'background.surface' : overlayColors.accentSubtle,
          color: 'text.primary',
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
                icon={<MapPin size={16} />}
                label={part.venueName}
                size="small"
                clickable
                onClick={() => onVenueClick?.(part)}
                sx={{
                  mx: 0.5,
                  my: 0.25,
                  cursor: 'pointer',
                  bgcolor: 'secondary.main',
                  color: 'secondary.contrastText',
                  '&:hover': {
                    bgcolor: 'secondary.dark',
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
            sx={{
              display: 'block',
              mt: 0.5,
              fontFamily: theme.typography.fontFamilyMono,
              fontSize: '0.75rem',
              color: 'text.disabled',
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
            title="Copy"
            sx={{
              position: 'absolute',
              top: 4,
              right: 4,
              opacity: 0,
              transition: 'opacity 0.2s',
            }}
          >
            <Copy size={16} />
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
