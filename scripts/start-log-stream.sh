#!/bin/bash

# Start Render log streaming in the background

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
PID_FILE="$PROJECT_DIR/logs/render-stream.pid"
LOG_OUTPUT="$PROJECT_DIR/logs/render-stream-output.log"

# Check if already running
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if ps -p "$PID" > /dev/null 2>&1; then
    echo "Log streaming is already running (PID: $PID)"
    exit 0
  else
    echo "Removing stale PID file..."
    rm "$PID_FILE"
  fi
fi

# Start the log stream
echo "Starting Render log stream..."
node "$SCRIPT_DIR/stream-render-logs.js" > "$LOG_OUTPUT" 2>&1 &
PID=$!

# Save PID
echo $PID > "$PID_FILE"

echo "Log stream started with PID: $PID"
echo "View logs: tail -f $PROJECT_DIR/logs/render-stream.log"
echo "Stop stream: $SCRIPT_DIR/stop-log-stream.sh"
