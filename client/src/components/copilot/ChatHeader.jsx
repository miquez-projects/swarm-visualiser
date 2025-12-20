import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { Trash, ArrowsOut, ArrowsIn, Minus, X } from '@phosphor-icons/react';

function ChatHeader({ onClose, onMinimize, onToggleExpand, isExpanded, onClear }) {
  return (
    <Box
      sx={{
        p: 2,
        borderBottom: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        Copilot
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <IconButton size="small" onClick={onClear} title="Clear history">
          <Trash size={18} />
        </IconButton>
        <IconButton size="small" onClick={onToggleExpand} title={isExpanded ? "Collapse" : "Expand"}>
          {isExpanded ? <ArrowsIn size={18} /> : <ArrowsOut size={18} />}
        </IconButton>
        <IconButton size="small" onClick={onMinimize} title="Minimize">
          <Minus size={18} />
        </IconButton>
        <IconButton size="small" onClick={onClose} title="Close">
          <X size={18} />
        </IconButton>
      </Box>
    </Box>
  );
}

export default ChatHeader;
