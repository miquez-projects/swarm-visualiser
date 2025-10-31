import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Drawer,
  useMediaQuery,
  useTheme as useMuiTheme
} from '@mui/material';
import {
  Brightness4,
  Brightness7,
  Menu as MenuIcon
} from '@mui/icons-material';

const DRAWER_WIDTH = 320;

function Layout({ children, darkMode, onToggleDarkMode, sidebar, headerActions, sidebarExpanded = false }) {
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      {/* App Bar */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          {isMobile && sidebar && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Swarm Visualizer
          </Typography>
          {headerActions}
          <IconButton color="inherit" onClick={onToggleDarkMode}>
            {darkMode ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Main Content Area */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        {/* Sidebar - Desktop */}
        {!isMobile && sidebar && (
          <Box
            sx={{
              width: sidebarExpanded ? '100%' : DRAWER_WIDTH,
              flexShrink: 0,
              borderRight: sidebarExpanded ? 0 : 1,
              borderColor: 'divider',
              overflowY: 'auto',
              transition: 'width 0.3s ease-in-out',
              zIndex: sidebarExpanded ? 1200 : 'auto',
              position: sidebarExpanded ? 'absolute' : 'relative',
              height: sidebarExpanded ? '100%' : 'auto',
              bgcolor: 'background.default'
            }}
          >
            {sidebar}
          </Box>
        )}

        {/* Sidebar - Mobile Drawer */}
        {isMobile && sidebar && (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              '& .MuiDrawer-paper': {
                width: DRAWER_WIDTH,
                boxSizing: 'border-box'
              }
            }}
          >
            {sidebar}
          </Drawer>
        )}

        {/* Main Content */}
        <Box sx={{ flexGrow: 1, overflow: 'hidden', display: sidebarExpanded && !isMobile ? 'none' : 'block' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

export default Layout;
