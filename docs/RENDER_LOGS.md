# Render Log Streaming

Automated log streaming from Render deployment to local development environment.

## Quick Start

```bash
# Start log streaming
npm run logs:start

# View logs in real-time
npm run logs:view

# Stop log streaming
npm run logs:stop
```

## What It Does

The log streaming system automatically polls the Render API every 5 seconds to fetch the latest logs from your deployed service. Logs are saved to `logs/render-stream.log` with timestamps and deduplication to prevent showing the same log entry multiple times.

## Files

- `scripts/stream-render-logs.js` - Node.js script that polls Render API
- `scripts/start-log-stream.sh` - Start the log stream in background
- `scripts/stop-log-stream.sh` - Stop the log stream
- `logs/render-stream.log` - Log output file (gitignored)
- `logs/render-stream.pid` - Process ID tracker (gitignored)
- `logs/render-stream-output.log` - Script console output (gitignored)

## Configuration

The scripts use the following configuration by default:
- **Service ID**: `srv-d41sc0ali9vc73bbtekg` (swarm-visualizer-api)
- **Owner ID**: `tea-d41s9be3jp1c739kjtu0`
- **API Key**: `rnd_1RTbypIE9c9tdpwQt2A1a0UdxkIG`
- **Poll Interval**: 5 seconds
- **Fetch Limit**: 50 most recent logs per request

You can override these via environment variables:
```bash
RENDER_API_KEY=your_key RENDER_SERVICE_ID=your_service npm run logs:start
```

## Usage Examples

### View recent logs
```bash
tail -50 logs/render-stream.log
```

### Search logs
```bash
grep "error" logs/render-stream.log
grep "copilot" logs/render-stream.log
```

### Watch logs live
```bash
npm run logs:view
# or
tail -f logs/render-stream.log
```

### Check if streaming is running
```bash
cat logs/render-stream.pid  # Shows PID if running
ps -p $(cat logs/render-stream.pid)  # Verify process is alive
```

## Troubleshooting

### Logs not appearing
1. Check if the process is running: `ps -p $(cat logs/render-stream.pid)`
2. Check script output: `tail logs/render-stream-output.log`
3. Verify API credentials are correct
4. Ensure Render service is active and generating logs

### Stop old processes
```bash
# Find and kill any orphaned processes
pkill -f "stream-render-logs.js"
```

### Fresh start
```bash
npm run logs:stop
rm -rf logs/
npm run logs:start
```

## How It Works

1. The Node.js script polls Render's REST API endpoint `/v1/logs`
2. Fetches the 50 most recent log entries in backward direction (newest first)
3. Reverses them to display chronologically (oldest to newest)
4. Tracks the last seen timestamp to avoid duplicates
5. Strips ANSI color codes for clean text output
6. Appends new logs to `logs/render-stream.log`

This approach works around Render's WebSocket `/v1/logs/subscribe` endpoint which requires WebSocket support not natively available in Node.js without additional dependencies.

## Benefits

- No need to manually copy-paste logs from Render dashboard
- Continuous monitoring during development
- Full log history persisted locally
- Can search and analyze logs with standard Unix tools
- Works across terminal sessions
- Lightweight - only polls when needed
