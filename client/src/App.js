import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme, darkTheme } from './theme';
import HomePage from './pages/HomePage';
import ImportPage from './pages/ImportPage';
import YearInReviewPage from './pages/YearInReviewPage';
import CopilotChat from './components/copilot/CopilotChat';

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [authToken, setAuthToken] = useState(
    localStorage.getItem('authToken') || null
  );

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

  return (
    <BrowserRouter>
      <ThemeProvider theme={darkMode ? darkTheme : lightTheme}>
        <CssBaseline />
        <Routes>
          <Route path="/" element={<HomePage darkMode={darkMode} onToggleDarkMode={handleThemeToggle} />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/year-in-review" element={<YearInReviewPage darkMode={darkMode} onToggleDarkMode={handleThemeToggle} />} />
        </Routes>
        {/* AI Copilot - show only if authenticated */}
        {authToken && <CopilotChat token={authToken} />}
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
