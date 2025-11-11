#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration - you can set these via environment variables
const API_KEY = process.env.RENDER_API_KEY || 'rnd_1RTbypIE9c9tdpwQt2A1a0UdxkIG';
const OWNER_ID = process.env.RENDER_OWNER_ID || 'tea-d41s9be3jp1c739kjtu0';
const SERVICE_ID = process.env.RENDER_SERVICE_ID || 'srv-d41sc0ali9vc73bbtekg';
const LOG_FILE = path.join(__dirname, '..', 'logs', 'render-stream.log');
const POLL_INTERVAL = 5000; // 5 seconds

// Track the last timestamp we've seen to avoid duplicates
let lastTimestamp = null;

// Ensure logs directory exists
const logsDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// For WebSocket streaming, we need to poll instead since Node doesn't have built-in WebSocket
// Let's use the regular logs endpoint with polling
function fetchLogs() {
  // Use backward direction to get most recent logs first
  const url = `https://api.render.com/v1/logs?ownerId=${OWNER_ID}&resource=${SERVICE_ID}&direction=backward&limit=50`;

  const options = {
    headers: {
      'accept': 'application/json',
      'authorization': `Bearer ${API_KEY}`
    }
  };

  https.get(url, options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        // Render API returns: { hasMore, logs: [...], nextStartTime, nextEndTime }
        if (response && response.logs && Array.isArray(response.logs)) {
          // Reverse logs since we're fetching backward (to show oldest to newest)
          const sortedLogs = response.logs.reverse();

          sortedLogs.forEach(log => {
            // Skip if we've already seen this timestamp
            if (lastTimestamp && log.timestamp && log.timestamp <= lastTimestamp) {
              return;
            }

            const timestamp = log.timestamp ? new Date(log.timestamp).toISOString().replace('T', ' ').substring(0, 19) : new Date().toISOString().replace('T', ' ').substring(0, 19);
            // Strip ANSI color codes from message
            const message = (log.message || JSON.stringify(log)).replace(/\u001b\[\d+m/g, '').replace(/\u001b\([BM]/g, '');
            const line = `${timestamp} ${message}\n`;
            fs.appendFileSync(LOG_FILE, line);
            console.log(line.trim());

            // Update last seen timestamp
            if (log.timestamp) {
              lastTimestamp = log.timestamp;
            }
          });
        }
      } catch (err) {
        console.error('Error parsing logs:', err.message);
      }
    });
  }).on('error', (err) => {
    console.error('Error fetching logs:', err.message);
  });
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Poll every 5 seconds
console.log(`Starting Render log polling for service ${SERVICE_ID}...`);
console.log(`Logs will be written to: ${LOG_FILE}`);
fetchLogs();
setInterval(fetchLogs, POLL_INTERVAL);
