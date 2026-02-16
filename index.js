const { TestBridge } = require('./lib/test-bridge');
const { sleep, generateTestUrl, getExtensionUrlForUuid, waitForCondition, TabUtils, Assert, TestResults, launchBrowser, cleanupBrowser, extensionDir } = require('./lib/test-helpers');
const { createTestServer } = require('./lib/test-http-server');
const { Command } = require('selenium-webdriver/lib/command');

module.exports = {
  TestBridge,
  sleep,
  generateTestUrl,
  getExtensionUrlForUuid,
  waitForCondition,
  TabUtils,
  Assert,
  TestResults,
  createTestServer,
  launchBrowser,
  cleanupBrowser,
  extensionDir,
  Command
};
