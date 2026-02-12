#!/usr/bin/env node
/**
 * Hello World — selenium-webext-bridge example test
 *
 * Demonstrates how to use the bridge to test a Firefox extension.
 *
 * Usage:
 *   node test.js
 *
 * Requires: Firefox in PATH, geckodriver, selenium-webdriver
 */

const path = require('path');
const { launchBrowser, cleanupBrowser, createTestServer } = require('../../');

const HELLO_EXT_DIR = path.join(__dirname, 'extension');
const HELLO_EXT_ID = 'hello-world@example.local';

async function main() {
  console.log('=== selenium-webext-bridge: Hello World Example ===\n');

  // 1. Start local HTTP server (bridge needs an http page to inject into)
  const server = await createTestServer({ port: 8080 });
  let browser;

  try {
    // 2. Launch Firefox with the bridge and our extension installed
    console.log('Launching Firefox...');
    browser = await launchBrowser({
      extensions: [HELLO_EXT_DIR]
    });
    const bridge = browser.testBridge;
    console.log('Bridge ready!\n');

    // 3. Talk to the extension via the bridge
    let result;

    // Ping
    result = await bridge.sendToExtension(HELLO_EXT_ID, { action: 'ping' });
    console.log('ping     →', result.data);

    // Greet
    result = await bridge.sendToExtension(HELLO_EXT_ID, { action: 'greet', name: 'World' });
    console.log('greet    →', result.data);

    // Counter
    result = await bridge.sendToExtension(HELLO_EXT_ID, { action: 'getCounter' });
    console.log('counter  →', result.data);

    await bridge.sendToExtension(HELLO_EXT_ID, { action: 'increment' });
    await bridge.sendToExtension(HELLO_EXT_ID, { action: 'increment' });
    result = await bridge.sendToExtension(HELLO_EXT_ID, { action: 'getCounter' });
    console.log('after 2x →', result.data);

    // Also demo the built-in tab APIs
    const tabs = await bridge.getTabs();
    console.log('tabs     →', tabs.length, 'open');

    console.log('\nAll checks passed!');

  } finally {
    await cleanupBrowser(browser);
    server.close();
  }
}

main().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
