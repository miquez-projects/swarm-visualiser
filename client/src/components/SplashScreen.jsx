import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography, CircularProgress, Alert } from '@mui/material';
import { validateToken } from '../services/api';

const SplashScreen = ({ onTokenValidated }) => {
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [token, setToken] = useState('');
  const [fadeOut, setFadeOut] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check for token in URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const storedToken = localStorage.getItem('authToken');

    if (urlToken || storedToken) {
      // Token exists - validate it first
      validateExistingToken(urlToken || storedToken);
    } else {
      // No token - show input after 1 second
      setTimeout(() => setShowTokenInput(true), 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateExistingToken = async (tokenToValidate) => {
    try {
      setIsValidating(true);
      await validateToken(tokenToValidate);

      // Token is valid - show for 2 seconds then fade
      setTimeout(() => setFadeOut(true), 2000);
      setTimeout(() => onTokenValidated(tokenToValidate), 2300);
    } catch (err) {
      // Token is invalid - clear it and show input
      localStorage.removeItem('authToken');
      setError('Your token is invalid or expired. Please enter a new one.');
      setShowTokenInput(true);
      setIsValidating(false);
    }
  };

  const handleTokenSubmit = async () => {
    if (!token.trim()) {
      setError('Please enter a token');
      return;
    }

    try {
      setIsValidating(true);
      setError('');

      // Validate token with backend
      await validateToken(token);

      // Token is valid - store and continue
      localStorage.setItem('authToken', token);
      setFadeOut(true);
      setTimeout(() => onTokenValidated(token), 300);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid token. Please check and try again.');
      setIsValidating(false);
    }
  };

  const handleSetupNewUser = () => {
    // Hide splash screen first
    onTokenValidated(null);
    // Then navigate after React re-renders
    setTimeout(() => {
      window.location.href = '/data-sources';
    }, 100);
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.3s ease-out',
        animation: 'gradient-shift 3s ease infinite'
      }}
    >
      <Box sx={{ position: 'absolute', top: '30%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography variant="h2" sx={{ color: 'white', fontWeight: 'bold', mb: 4 }}>
          Life Visualizer
        </Typography>

        {isValidating && (
          <CircularProgress sx={{ color: 'white' }} />
        )}

        {showTokenInput && !isValidating && (
          <Box sx={{ width: 400, maxWidth: '90%' }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Enter your token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleTokenSubmit()}
            autoFocus
            disabled={isValidating}
            sx={{
              bgcolor: 'white',
              borderRadius: 1,
              mb: 2,
              '& input': {
                cursor: 'text',
                animation: 'blink 1s step-end infinite'
              }
            }}
          />
          <Button
            fullWidth
            variant="contained"
            onClick={handleTokenSubmit}
            disabled={isValidating}
            sx={{ mb: 1, bgcolor: 'white', color: '#ff6b35' }}
          >
            Continue
          </Button>
          <Button
            fullWidth
            variant="text"
            onClick={handleSetupNewUser}
            disabled={isValidating}
            sx={{ color: 'white' }}
          >
            Set up a new user
          </Button>
        </Box>
      )}
      </Box>

      <style jsx>{`
        @keyframes gradient-shift {
          0%, 100% { filter: hue-rotate(0deg); }
          50% { filter: hue-rotate(10deg); }
        }
        @keyframes blink {
          50% { border-color: transparent; }
        }
      `}</style>
    </Box>
  );
};

export default SplashScreen;
