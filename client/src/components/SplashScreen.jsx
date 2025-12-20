import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography, CircularProgress, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { validateToken } from '../services/api';

const SplashScreen = ({ onTokenValidated }) => {
  const theme = useTheme();
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [token, setToken] = useState('');
  const [fadeOut, setFadeOut] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => {
    // Animation sequence
    const timer1 = setTimeout(() => setAnimationPhase(1), 500);
    const timer2 = setTimeout(() => setAnimationPhase(2), 1200);

    // Check for token in URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const storedToken = localStorage.getItem('authToken');

    if (urlToken || storedToken) {
      validateExistingToken(urlToken || storedToken);
    } else {
      setTimeout(() => setShowTokenInput(true), 2000);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateExistingToken = async (tokenToValidate) => {
    try {
      setIsValidating(true);
      await validateToken(tokenToValidate);
      setTimeout(() => setFadeOut(true), 2000);
      setTimeout(() => onTokenValidated(tokenToValidate), 2300);
    } catch (err) {
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
      await validateToken(token);
      localStorage.setItem('authToken', token);
      setFadeOut(true);
      setTimeout(() => onTokenValidated(token), 300);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid token. Please check and try again.');
      setIsValidating(false);
    }
  };

  const handleSetupNewUser = () => {
    onTokenValidated(null);
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
        bgcolor: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.3s ease-out',
        overflow: 'hidden',
      }}
    >
      {/* Coordinate Grid Background */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: animationPhase >= 1 ? 0.15 : 0,
          transition: 'opacity 1s ease-in',
          backgroundImage: `
            linear-gradient(rgba(45, 154, 140, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(45, 154, 140, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          backgroundPosition: 'center center',
        }}
      />

      {/* Radial Fade */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at center, transparent 0%, #0a0a0a 70%)',
        }}
      />

      {/* Content */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: animationPhase >= 2 ? 1 : 0,
          transform: animationPhase >= 2 ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.8s ease-out',
        }}
      >
        <Typography
          variant="h2"
          sx={{
            color: 'text.primary',
            fontWeight: 700,
            mb: 1,
            letterSpacing: '-0.02em',
          }}
        >
          Life Visualizer
        </Typography>

        <Typography
          sx={{
            fontFamily: theme.typography.fontFamilyMono,
            fontSize: '0.75rem',
            color: 'text.secondary',
            mb: 6,
            letterSpacing: '0.1em',
          }}
        >
          48.2082° N, 16.3738° E
        </Typography>

        {isValidating && !showTokenInput && (
          <CircularProgress size={32} />
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
              sx={{ mb: 2 }}
            />
            <Button
              fullWidth
              variant="contained"
              onClick={handleTokenSubmit}
              disabled={isValidating}
              sx={{ mb: 1 }}
            >
              Continue
            </Button>
            <Button
              fullWidth
              variant="text"
              onClick={handleSetupNewUser}
              disabled={isValidating}
              sx={{ color: 'text.secondary' }}
            >
              Set up a new user
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default SplashScreen;
