/**
 * Local HTTP server for serving test pages
 * This allows TestBridge content scripts to inject into real HTTP pages offline
 */

const http = require('http');

/**
 * Create and start a local HTTP test server
 * @param {Object} options
 * @param {number} options.port - Port to listen on (default: 8080)
 * @param {string} options.host - Host to bind to (default: '127.0.0.1')
 * @returns {Promise<http.Server>} The running server instance
 */
function createTestServer({ port = 8080, host = '127.0.0.1' } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const testName = req.url.replace('/', '') || 'test';
      const timestamp = Date.now();

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${testName}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      background: #f5f5f5;
    }
    .content {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <div class="content">
    <h1>Test Page: ${testName}</h1>
    <p>Timestamp: ${timestamp}</p>
    <p>This page is served by the local test server for integration tests.</p>
    <div id="keepalive"></div>
  </div>
  <script>
    // Keep page active to prevent Firefox from discarding context
    setInterval(() => {
      document.getElementById('keepalive').textContent = 'Active: ' + Date.now();
    }, 5000);
  </script>
</body>
</html>`);
    });

    server.on('error', reject);

    server.listen(port, host, () => {
      console.log(`HTTP test server running on: http://${host}:${port}`);
      resolve(server);
    });
  });
}

// If run directly (not imported), start the server
if (require.main === module) {
  createTestServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

  process.on('SIGTERM', () => process.exit(0));
  process.on('SIGINT', () => process.exit(0));
}

module.exports = { createTestServer };
