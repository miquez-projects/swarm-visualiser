# SyncProgressBar Component Usage Examples

## Basic Usage

```jsx
import SyncProgressBar from '../components/SyncProgressBar';

function DataSourcesPage() {
  const [jobId, setJobId] = useState(null);
  const [token] = useState(localStorage.getItem('authToken'));

  const handleSyncComplete = (status) => {
    console.log('Sync completed:', status);
    // Refresh data or update UI
    setJobId(null);
  };

  const handleSyncError = (error) => {
    console.error('Sync failed:', error);
    // Show error message
    setJobId(null);
  };

  const handleStartSync = async () => {
    const response = await fetch('/api/strava/sync', {
      method: 'POST',
      headers: { 'x-auth-token': token }
    });
    const { jobId } = await response.json();
    setJobId(jobId);
  };

  return (
    <div>
      <Button onClick={handleStartSync}>Sync Strava</Button>

      {jobId && (
        <SyncProgressBar
          jobId={jobId}
          token={token}
          dataSource="strava"
          onComplete={handleSyncComplete}
          onError={handleSyncError}
        />
      )}
    </div>
  );
}
```

## Integration with DataSourcesPage.jsx

### For Garmin Sync (Replace lines 227-256)

```jsx
const [garminJobId, setGarminJobId] = useState(null);

const handleGarminSync = async () => {
  try {
    const response = await fetch(`${API_URL}/api/garmin/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      },
      body: JSON.stringify({ syncType: 'incremental' })
    });

    const { jobId } = await response.json();
    setGarminJobId(jobId);
  } catch (error) {
    console.error('Garmin sync error:', error);
    setError('Failed to start Garmin sync');
  }
};

const handleGarminSyncComplete = () => {
  setSuccess('Garmin sync completed!');
  setGarminJobId(null);
  fetchGarminStatus();
  fetchUserData();
};

const handleGarminSyncError = (error) => {
  setError(`Garmin sync failed: ${error}`);
  setGarminJobId(null);
};

// In the JSX:
<Box display="flex" flexDirection="column" gap={1}>
  <Box display="flex" gap={1}>
    <Button
      variant="outlined"
      onClick={handleGarminSync}
      disabled={!!garminJobId}
    >
      Sync Now
    </Button>
    <Button
      variant="outlined"
      color="error"
      onClick={handleGarminDisconnect}
    >
      Disconnect
    </Button>
  </Box>

  {garminJobId && (
    <SyncProgressBar
      jobId={garminJobId}
      token={token}
      dataSource="garmin"
      onComplete={handleGarminSyncComplete}
      onError={handleGarminSyncError}
    />
  )}
</Box>
```

### For Strava Sync (Replace lines 303-331)

```jsx
const [stravaJobId, setStravaJobId] = useState(null);

const handleStravaSync = async () => {
  try {
    const response = await fetch(`${API_URL}/api/strava/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      }
    });

    const { jobId } = await response.json();
    setStravaJobId(jobId);
  } catch (error) {
    console.error('Strava sync error:', error);
    setError('Failed to start Strava sync');
  }
};

const handleStravaSyncComplete = () => {
  setSuccess('Strava sync completed!');
  setStravaJobId(null);
  fetchStravaStatus();
  fetchUserData();
};

const handleStravaSyncError = (error) => {
  setError(`Strava sync failed: ${error}`);
  setStravaJobId(null);
};

// In the JSX:
<Box display="flex" flexDirection="column" gap={1}>
  <Box display="flex" gap={1}>
    <Button
      variant="outlined"
      onClick={handleStravaSync}
      disabled={!!stravaJobId}
    >
      Sync Now
    </Button>
    <Button
      variant="outlined"
      color="error"
      onClick={handleStravaDisconnect}
    >
      Disconnect
    </Button>
  </Box>

  {stravaJobId && (
    <SyncProgressBar
      jobId={stravaJobId}
      token={token}
      dataSource="strava"
      onComplete={handleStravaSyncComplete}
      onError={handleStravaSyncError}
    />
  )}
</Box>
```

## Props API

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `jobId` | string | Yes | - | The import job ID to track |
| `token` | string | Yes | - | Authentication token |
| `dataSource` | string | No | 'data' | Data source name ('foursquare', 'strava', 'garmin') |
| `onComplete` | function | No | - | Callback when sync completes: `(status) => {}` |
| `onError` | function | No | - | Callback when sync fails: `(error) => {}` |

## Features

- Polls `/api/import/status/:jobId` every 2 seconds
- Shows determinate progress bar when `totalExpected` is available
- Shows indeterminate progress bar when only `totalImported` is known
- Automatically stops polling when sync completes or fails
- Displays success/error alerts based on final status
- Cleans up polling interval on component unmount
- Handles authentication errors gracefully

## Status Display

### Pending/Running
- Progress bar (determinate or indeterminate)
- Text: "Syncing [DataSource]... X / Y (Z%)" or "Syncing [DataSource]... X items"

### Completed
- Green success alert
- Text: "[DataSource] sync complete! (X items)"

### Failed
- Red error alert
- Text: "[DataSource] sync failed: [error message]"
