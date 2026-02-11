const path = require('path');

const { TestBridge } = require('./lib/test-bridge');
const { sleep, generateTestUrl, waitForCondition, TabUtils, Assert, TestResults } = require('./lib/test-helpers');
const { createTestServer } = require('./lib/test-http-server');

const extensionDir = path.join(__dirname, 'extension');

module.exports = {
  TestBridge,
  sleep,
  generateTestUrl,
  waitForCondition,
  TabUtils,
  Assert,
  TestResults,
  createTestServer,
  extensionDir
};
