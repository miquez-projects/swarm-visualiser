import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
  Snackbar,
  Alert,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  List,
  ArrowsClockwise,
  Gear,
  MapTrifold,
  Calendar,
  Sun,
} from '@phosphor-icons/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { syncAllData } from '../services/api';

const ContextMenu = ({ token, lastSyncAt, onSyncComplete }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const isYearInReview = location.pathname === '/year-in-review';
  const isDayInLife = location.pathname.startsWith('/day-in-life');
  const isHome = location.pathname === '/';

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSyncAll = async () => {
    handleClose();
    setSyncing(true);
    try {
      await syncAllData(token);
      onSyncComplete?.();
      setSnackbar({
        open: true,
        message: 'Sync completed successfully!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Sync failed:', error);
      setSnackbar({
        open: true,
        message: 'Sync failed. Please try again.',
        severity: 'error'
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleDataSources = () => {
    handleClose();
    navigate('/data-sources');
  };

  return (
    <>
      <IconButton color="inherit" onClick={handleOpen} disabled={syncing}>
        {syncing ? <CircularProgress size={24} color="inherit" /> : <List size={24} />}
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {/* Navigation items - only on mobile */}
        {isMobile && (
          <>
            {!isHome && (
              <MenuItem onClick={() => { handleClose(); navigate('/'); }}>
                <ListItemIcon>
                  <MapTrifold size={18} />
                </ListItemIcon>
                <ListItemText primary="Map" />
              </MenuItem>
            )}
            {!isYearInReview && (
              <MenuItem onClick={() => { handleClose(); navigate('/year-in-review'); }}>
                <ListItemIcon>
                  <Calendar size={18} />
                </ListItemIcon>
                <ListItemText primary="Year in Review" />
              </MenuItem>
            )}
            {!isDayInLife && (
              <MenuItem onClick={() => { handleClose(); navigate('/day-in-life'); }}>
                <ListItemIcon>
                  <Sun size={18} />
                </ListItemIcon>
                <ListItemText primary="Day in Life" />
              </MenuItem>
            )}
            <Divider />
          </>
        )}

        {/* Settings items */}
        <MenuItem onClick={handleDataSources}>
          <ListItemIcon>
            <Gear size={18} />
          </ListItemIcon>
          <ListItemText primary="Data Sources" />
        </MenuItem>

        <MenuItem onClick={handleSyncAll}>
          <ListItemIcon>
            <ArrowsClockwise size={18} />
          </ListItemIcon>
          <ListItemText primary="Sync All Data" />
        </MenuItem>

        <Divider />

        <MenuItem disabled>
          <ListItemText
            secondary={
              lastSyncAt
                ? `Last synced: ${new Date(lastSyncAt).toLocaleString()}`
                : 'Never synced'
            }
          />
        </MenuItem>
      </Menu>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

ContextMenu.propTypes = {
  token: PropTypes.string.isRequired,
  lastSyncAt: PropTypes.string,
  onSyncComplete: PropTypes.func
};

export default ContextMenu;
