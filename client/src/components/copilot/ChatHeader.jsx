import React from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { Close, Minimize, Fullscreen, FullscreenExit, Delete } from '@mui/icons-material';

function ChatHeader({ onClose, onMinimize, onToggleExpand, isExpanded, onClear }) {
  return (
    <Box
      sx={{
        p: 2,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
        Swarm Copilot
      </Typography>

      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Tooltip title="Clear history">
          <IconButton size="small" onClick={onClear} sx={{ color: 'inherit' }}>
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title={isExpanded ? "Normal view" : "Expand"}>
          <IconButton size="small" onClick={onToggleExpand} sx={{ color: 'inherit' }}>
            {isExpanded ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Minimize">
          <IconButton size="small" onClick={onMinimize} sx={{ color: 'inherit' }}>
            <Minimize fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Close">
          <IconButton size="small" onClick={onClose} sx={{ color: 'inherit' }}>
            <Close fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

export default ChatHeader;
