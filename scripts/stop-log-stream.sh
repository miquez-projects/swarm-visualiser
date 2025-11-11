#!/bin/bash

# Stop Render log streaming

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
PID_FILE="$PROJECT_DIR/logs/render-stream.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "Log stream is not running (no PID file found)"
  exit 0
fi

PID=$(cat "$PID_FILE")

if ps -p "$PID" > /dev/null 2>&1; then
  echo "Stopping log stream (PID: $PID)..."
  kill "$PID"
  rm "$PID_FILE"
  echo "Log stream stopped"
else
  echo "Log stream is not running (stale PID file)"
  rm "$PID_FILE"
fi
