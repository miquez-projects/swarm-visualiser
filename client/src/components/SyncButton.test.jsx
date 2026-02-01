import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SyncButton from './SyncButton';

// Mock the API module
vi.mock('../services/api', () => ({
  startSync: vi.fn(),
  getSyncStatus: vi.fn(),
  getLatestImport: vi.fn()
}));

// Mock phosphor-icons
vi.mock('@phosphor-icons/react', () => ({
  ArrowsClockwise: (props) => {
    const React = require('react');
    return React.createElement('span', { 'data-testid': 'sync-icon', ...props });
  }
}));

import { startSync, getSyncStatus, getLatestImport } from '../services/api';

describe('SyncButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getLatestImport.mockResolvedValue({ job: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('renders sync button with default text', async () => {
    render(<SyncButton token="test-token" />);

    await waitFor(() => {
      expect(screen.getByText('Sync Check-ins')).toBeInTheDocument();
    });
  });

  test('calls startSync API on click', async () => {
    startSync.mockResolvedValue({ jobId: 42 });
    getSyncStatus.mockResolvedValue({ status: 'running', totalImported: 0, totalExpected: 0 });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SyncButton token="test-token" />);

    await waitFor(() => {
      expect(screen.getByText('Sync Check-ins')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sync Check-ins'));

    expect(startSync).toHaveBeenCalledWith('test-token');
  });

  test('shows syncing state after click', async () => {
    startSync.mockResolvedValue({ jobId: 42 });
    getSyncStatus.mockResolvedValue({ status: 'running', totalImported: 0, totalExpected: 0 });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SyncButton token="test-token" />);

    await waitFor(() => {
      expect(screen.getByText('Sync Check-ins')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sync Check-ins'));

    await waitFor(() => {
      expect(screen.getByText('Syncing...')).toBeInTheDocument();
    });
  });

  test('shows error toast on startSync failure', async () => {
    startSync.mockRejectedValue(new Error('Network error'));

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SyncButton token="test-token" />);

    await waitFor(() => {
      expect(screen.getByText('Sync Check-ins')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sync Check-ins'));

    await waitFor(() => {
      expect(screen.getByText('Failed to start sync. Check your connection.')).toBeInTheDocument();
    });
  });

  test('handles 409 conflict by resuming existing sync', async () => {
    startSync.mockRejectedValue({
      response: { status: 409, data: { jobId: 99 } }
    });
    getSyncStatus.mockResolvedValue({ status: 'running', totalImported: 5, totalExpected: 10 });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SyncButton token="test-token" />);

    await waitFor(() => {
      expect(screen.getByText('Sync Check-ins')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sync Check-ins'));

    await waitFor(() => {
      expect(screen.getByText('Sync already in progress...')).toBeInTheDocument();
    });
  });

  test('shows auth error toast on 401', async () => {
    startSync.mockRejectedValue({
      response: { status: 401 }
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SyncButton token="test-token" />);

    await waitFor(() => {
      expect(screen.getByText('Sync Check-ins')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sync Check-ins'));

    await waitFor(() => {
      expect(screen.getByText('Authentication failed. Please refresh your link.')).toBeInTheDocument();
    });
  });

  test('resumes existing sync on mount', async () => {
    getLatestImport.mockResolvedValue({
      job: { id: 55, status: 'running', totalImported: 3, totalExpected: 10 }
    });
    getSyncStatus.mockResolvedValue({ status: 'running', totalImported: 3, totalExpected: 10 });

    render(<SyncButton token="test-token" />);

    await waitFor(() => {
      expect(screen.getByText('Syncing 30%')).toBeInTheDocument();
    });
  });
});
