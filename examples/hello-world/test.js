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
const { Builder } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
const { TestBridge, extensionDir, sleep, createTestServer } = require('../../');

const HELLO_EXT_DIR = path.join(__dirname, 'extension');
const HELLO_EXT_ID = 'hello-world@example.local';

async function main() {
  console.log('=== selenium-webext-bridge: Hello World Example ===\n');

  // 1. Start local HTTP server (bridge needs an http page to inject into)
  const server = await createTestServer({ port: 8080 });
  let driver;

  try {
    // 2. Launch Firefox
    console.log('Launching Firefox...');
    const options = new firefox.Options();
    driver = await new Builder()
      .forBrowser('firefox')
      .setFirefoxOptions(options)
      .build();

    // 3. Install the bridge extension
    console.log('Installing bridge extension...');
    await driver.installAddon(extensionDir, true);
    await sleep(2000);

    // 4. Create a TestBridge and initialize it
    const bridge = new TestBridge(driver);
    await bridge.init();
    console.log('Bridge ready!\n');

    // 5. Install our extension under test
    console.log('Installing Hello World extension...');
    await driver.installAddon(HELLO_EXT_DIR, true);
    await sleep(2000);

    // 6. Talk to the extension via the bridge
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
    if (driver) await driver.quit();
    server.close();
  }
}

main().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
