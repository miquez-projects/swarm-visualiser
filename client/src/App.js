import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme, darkTheme } from './theme';
import HomePage from './pages/HomePage';
import ImportPage from './pages/ImportPage';
import YearInReviewPage from './pages/YearInReviewPage';

function App() {
  const [darkMode, setDarkMode] = useState(false);

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
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
