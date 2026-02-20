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
const HELLO_EXT_NAME = 'Hello World Extension';

async function main() {
  console.log();
  console.log('selenium-webext-bridge Hello World Example');
  console.log('================================================================');
  console.log();

  // First, start local HTTP server (bridge needs an http page to inject into)
  const server = await createTestServer({ port: 8080 });
  let browser;

  try {
    // Second, launch Firefox with the bridge and our extension installed
    console.log('Launching Firefox...');
    browser = await launchBrowser({
      extensions: [HELLO_EXT_DIR]
    });
    const bridge = browser.testBridge;
    let result;

    console.log();
    console.log('----- Basic Functionality -----');

    // Ping
    result = await bridge.sendToExtension(HELLO_EXT_ID, { action: 'ping' });
    console.log('ping:', result.data);

    // Greet
    result = await bridge.sendToExtension(HELLO_EXT_ID, { action: 'greet', name: 'World' });
    console.log('greet:', result.data);

    // Counter
    result = await bridge.sendToExtension(HELLO_EXT_ID, { action: 'getCounter' });
    console.log('counter:', result.data);

    await bridge.sendToExtension(HELLO_EXT_ID, { action: 'increment' });
    await bridge.sendToExtension(HELLO_EXT_ID, { action: 'increment' });
    result = await bridge.sendToExtension(HELLO_EXT_ID, { action: 'getCounter' });
    console.log('after 2x:', result.data);

    console.log();
    console.log('----- Find Extension URL -----');

    // Look up the extension's internal URL by ID and by name
    const urlById = await bridge.getExtensionUrl(HELLO_EXT_ID);
    console.log('url (id):', urlById);

    const urlByName = await bridge.getExtensionUrlByName(HELLO_EXT_NAME);
    console.log('url (name):', urlByName);

    if (urlById !== urlByName) {
      throw new Error(`URL mismatch: getExtensionUrl returned "${urlById}" but getExtensionUrlByName returned "${urlByName}"`);
    }
    console.log('match: both methods return the same URL');

    console.log();
    console.log('----- Tab API -----');

    // Also demo the built-in tab APIs
    const tabs = await bridge.getTabs();
    console.log('tabs:', tabs.length, 'open');

    console.log();
    console.log('All checks passed!');

  } finally {
    await cleanupBrowser(browser);
    server.close();
  }
}

main().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
