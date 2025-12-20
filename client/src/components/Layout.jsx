import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Drawer,
  useMediaQuery,
  useTheme as useMuiTheme,
  Button
} from '@mui/material';
import {
  Funnel,
  CalendarBlank,
  MapTrifold,
  Sun
} from '@phosphor-icons/react';
import ContextMenu from './ContextMenu';

const DRAWER_WIDTH = 320;

function Layout({ children, sidebar, headerActions, sidebarExpanded = false, token, lastSyncAt, onSyncComplete }) {
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const isYearInReview = location.pathname === '/year-in-review';
  const isDayInLife = location.pathname.startsWith('/day-in-life');
  const isHome = location.pathname === '/';

  return (
    <Box sx={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      {/* App Bar */}
      <AppBar position="static">
        <Toolbar>
          {isMobile && sidebar && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <Funnel size={24} />
            </IconButton>
          )}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Swarm Visualizer
          </Typography>

          {/* Navigation Buttons - Hidden on mobile */}
          {!isMobile && (
            <>
              <Button
                color="inherit"
                startIcon={<MapTrifold size={20} />}
                onClick={() => navigate('/')}
                sx={{ mr: 1, display: isHome ? 'none' : 'flex' }}
              >
                Map
              </Button>
              <Button
                color="inherit"
                startIcon={<CalendarBlank size={20} />}
                onClick={() => navigate('/year-in-review')}
                sx={{ mr: 1, display: isYearInReview ? 'none' : 'flex' }}
              >
                Year in Review
              </Button>
              <Button
                color="inherit"
                startIcon={<Sun size={20} />}
                onClick={() => navigate('/day-in-life')}
                sx={{ mr: 1, display: isDayInLife ? 'none' : 'flex' }}
              >
                Day in Life
              </Button>
            </>
          )}

          {headerActions}
          {token && (
            <ContextMenu
              token={token}
              lastSyncAt={lastSyncAt}
              onSyncComplete={onSyncComplete}
            />
          )}
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
        <Box sx={{ flexGrow: 1, overflowY: 'auto', display: sidebarExpanded && !isMobile ? 'none' : 'block' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}

export default Layout;
