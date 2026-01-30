import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import SyncProgressBar from './SyncProgressBar';

// Mock the API module
jest.mock('../services/api', () => ({
  getSyncStatus: jest.fn()
}));

const { getSyncStatus } = require('../services/api');

const theme = createTheme();

function renderWithTheme(ui) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

// Mock scrollIntoView which is not available in jsdom
Element.prototype.scrollIntoView = jest.fn();

describe('SyncProgressBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('shows indeterminate progress bar when no totalExpected', async () => {
    getSyncStatus.mockResolvedValue({
      status: 'running',
      totalImported: 5,
      totalExpected: 0
    });

    renderWithTheme(
      <SyncProgressBar jobId="123" token="test-token" dataSource="strava" />
    );

    await waitFor(() => {
      expect(screen.getByText(/Syncing Strava/)).toBeInTheDocument();
      expect(screen.getByText(/5 items/)).toBeInTheDocument();
    });
  });

  test('shows determinate progress with percentage', async () => {
    getSyncStatus.mockResolvedValue({
      status: 'running',
      totalImported: 50,
      totalExpected: 100
    });

    renderWithTheme(
      <SyncProgressBar jobId="123" token="test-token" dataSource="foursquare" />
    );

    await waitFor(() => {
      expect(screen.getByText(/50 \/ 100 \(50%\)/)).toBeInTheDocument();
    });

    // Verify the progress bar has determinate variant
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
  });

  test('shows completion state and calls onComplete', async () => {
    const onComplete = jest.fn();
    getSyncStatus.mockResolvedValue({
      status: 'completed',
      totalImported: 100,
      totalExpected: 100
    });

    renderWithTheme(
      <SyncProgressBar jobId="123" token="test-token" dataSource="strava" onComplete={onComplete} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Strava sync complete! 100 activities imported/)).toBeInTheDocument();
      expect(onComplete).toHaveBeenCalled();
    });
  });

  test('shows completion with zero imports', async () => {
    getSyncStatus.mockResolvedValue({
      status: 'completed',
      totalImported: 0,
      totalExpected: 0
    });

    renderWithTheme(
      <SyncProgressBar jobId="123" token="test-token" dataSource="strava" />
    );

    await waitFor(() => {
      expect(screen.getByText(/no new activities to import/)).toBeInTheDocument();
    });
  });

  test('shows error state and calls onError on failure', async () => {
    const onError = jest.fn();
    getSyncStatus.mockResolvedValue({
      status: 'failed',
      totalImported: 0,
      totalExpected: 100,
      errorMessage: 'Rate limit exceeded'
    });

    renderWithTheme(
      <SyncProgressBar jobId="123" token="test-token" dataSource="strava" onError={onError} />
    );

    await waitFor(() => {
      expect(screen.getByText(/Strava sync failed/)).toBeInTheDocument();
      expect(screen.getByText(/Rate limit exceeded/)).toBeInTheDocument();
      expect(onError).toHaveBeenCalledWith('Rate limit exceeded');
    });
  });

  test('shows warning when partial import before failure', async () => {
    const onError = jest.fn();
    getSyncStatus.mockResolvedValue({
      status: 'failed',
      totalImported: 25,
      totalExpected: 100,
      errorMessage: 'Rate limit'
    });

    renderWithTheme(
      <SyncProgressBar jobId="123" token="test-token" dataSource="strava" onError={onError} />
    );

    await waitFor(() => {
      expect(screen.getByText(/25 activities imported before error/)).toBeInTheDocument();
      expect(screen.getByText(/You can try syncing again later/)).toBeInTheDocument();
    });
  });

  test('does not poll when jobId is missing', () => {
    renderWithTheme(
      <SyncProgressBar token="test-token" dataSource="strava" />
    );

    expect(getSyncStatus).not.toHaveBeenCalled();
  });

  test('does not poll when token is missing', () => {
    renderWithTheme(
      <SyncProgressBar jobId="123" dataSource="strava" />
    );

    expect(getSyncStatus).not.toHaveBeenCalled();
  });

  test('uses singular "activity" for count of 1', async () => {
    getSyncStatus.mockResolvedValue({
      status: 'completed',
      totalImported: 1,
      totalExpected: 1
    });

    renderWithTheme(
      <SyncProgressBar jobId="123" token="test-token" dataSource="strava" />
    );

    await waitFor(() => {
      expect(screen.getByText(/1 activity imported/)).toBeInTheDocument();
    });
  });
});
