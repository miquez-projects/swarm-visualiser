import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme, darkTheme } from './theme';
import HomePage from './pages/HomePage';
import ImportPage from './pages/ImportPage';
import YearInReviewPage from './pages/YearInReviewPage';
import DataSourcesPage from './pages/DataSourcesPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import DayInLifePage from './pages/DayInLifePage';
import SplashScreen from './components/SplashScreen';
import CopilotChat from './components/copilot/CopilotChat';

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [authToken, setAuthToken] = useState(
    localStorage.getItem('authToken') || null
  );
  const mapRef = useRef(null);

  // Listen for token changes
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token !== authToken) {
      setAuthToken(token);
    }
  }, [authToken]);

  const handleThemeToggle = () => {
    setDarkMode(!darkMode);
  };

  const handleTokenValidated = (token) => {
    if (token) {
      localStorage.setItem('authToken', token);
      setAuthToken(token);
    }
    setShowSplash(false);
  };

  const handleVenueClickFromChat = (venue) => {
    // Pan and zoom map to venue
    if (mapRef.current) {
      mapRef.current.easeTo({
        center: [venue.longitude, venue.latitude],
        zoom: 15,
        duration: 1000
      });
    }
  };

  return (
    <>
      {showSplash && <SplashScreen onTokenValidated={handleTokenValidated} />}
      <BrowserRouter>
        <ThemeProvider theme={darkMode ? darkTheme : lightTheme}>
          <CssBaseline />
          <Routes>
            <Route path="/" element={<HomePage darkMode={darkMode} onToggleDarkMode={handleThemeToggle} mapRef={mapRef} />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/year-in-review" element={<YearInReviewPage darkMode={darkMode} onToggleDarkMode={handleThemeToggle} />} />
            <Route path="/day-in-life/:date" element={<DayInLifePage darkMode={darkMode} onToggleDarkMode={handleThemeToggle} />} />
            <Route path="/day-in-life" element={<DayInLifePage darkMode={darkMode} onToggleDarkMode={handleThemeToggle} />} />
            <Route path="/data-sources" element={<DataSourcesPage darkMode={darkMode} onToggleDarkMode={handleThemeToggle} />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
          </Routes>
          {/* AI Copilot - show only if authenticated */}
          {authToken && <CopilotChat token={authToken} onVenueClick={handleVenueClickFromChat} />}
        </ThemeProvider>
      </BrowserRouter>
    </>
  );
}

export default App;
