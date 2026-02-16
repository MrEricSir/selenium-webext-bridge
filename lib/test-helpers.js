/**
 * Test Helpers: Generic utilities for WebExtension Selenium tests.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const extensionDir = path.join(__dirname, '..', 'extension');

/**
 * Sleeps for a given number of milliseconds.
 * @param {*} ms The number of milliseconds to sleep
 * @returns A promise that resolves after the delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generates a unique URL on the local test server.
 * @param {*} testName Name/identifier for the test; defaults to 'test'
 * @param {*} port HTTP server port; defaults to 8080
 * @returns A URL in the format http://127.0.0.1:<port>/<testName>-<timestamp>
 */
function generateTestUrl(testName = 'test', port = 8080) {
  const timestamp = Date.now();
  return `http://127.0.0.1:${port}/${testName}-${timestamp}`;
}

/**
 * Generates a URL for an installed extension by UUID.
 * @param {*} uuid Installed extension UUID
 * @returns A URL in the format moz-extension://uuid
 */
function getExtensionUrlForUuid(uuid) {
  return `moz-extension://${uuid}`;
}

/**
 * TabUtils: Browser tab utilities using Selenium WebDriver directly.
 */
class TabUtils {
  /**
   * Creates a TabUtils instance.
   * @param {*} driver The Selenium WebDriver instance
   */
  constructor(driver) {
    this.driver = driver;
  }

  /**
   * Opens a new tab and optionally navigates to a URL.
   * @param {*} url The URL to open; defaults to 'about:blank'
   */
  async openTab(url = 'about:blank') {
    await this.driver.switchTo().newWindow('tab');
    if (url !== 'about:blank') {
      await this.driver.get(url);
    }
    await sleep(500);
  }

  /**
   * Closes the current tab and switches to the first remaining tab.
   */
  async closeCurrentTab() {
    await this.driver.close();

    const handles = await this.driver.getAllWindowHandles();
    if (handles.length > 0) {
      await this.driver.switchTo().window(handles[0]);
    }

    await sleep(500);
  }

  /**
   * Gets the number of open tabs.
   * @returns The tab count
   */
  async getTabCount() {
    const handles = await this.driver.getAllWindowHandles();
    return handles.length;
  }

  /**
   * Switches Selenium focus to the tab at the given index.
   * @param {*} index The zero-based tab index to switch to
   */
  async switchToTab(index) {
    const handles = await this.driver.getAllWindowHandles();
    if (index >= 0 && index < handles.length) {
      await this.driver.switchTo().window(handles[index]);
    } else {
      throw new Error(`Tab index ${index} out of range (0-${handles.length - 1})`);
    }
  }
}

/**
 * Assert: Simple assertion utilities for tests.
 */
class Assert {
  /**
   * Asserts that two values are strictly equal.
   * @param {*} actual The actual value
   * @param {*} expected The expected value
   * @param {*} message Optional error message
   */
  static async equal(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }

  /**
   * Asserts that a value is greater than a threshold.
   * @param {*} actual The actual value
   * @param {*} threshold The threshold to compare against
   * @param {*} message Optional error message
   */
  static async greaterThan(actual, threshold, message) {
    if (actual <= threshold) {
      throw new Error(message || `Expected > ${threshold}, got ${actual}`);
    }
  }

  /**
   * Asserts that a value is less than a threshold.
   * @param {*} actual The actual value
   * @param {*} threshold The threshold to compare against
   * @param {*} message Optional error message
   */
  static async lessThan(actual, threshold, message) {
    if (actual >= threshold) {
      throw new Error(message || `Expected < ${threshold}, got ${actual}`);
    }
  }

  /**
   * Asserts that an array includes a given item.
   * @param {*} array The array to search
   * @param {*} item The item to look for
   * @param {*} message Optional error message
   */
  static async includes(array, item, message) {
    if (!array.includes(item)) {
      throw new Error(message || `Expected array to include ${item}`);
    }
  }

  /**
   * Asserts that a value is strictly true.
   * @param {*} value The value to check
   * @param {*} message Optional error message
   */
  static async isTrue(value, message) {
    if (value !== true) {
      throw new Error(message || `Expected true, got ${value}`);
    }
  }

  /**
   * Asserts that a value is strictly false.
   * @param {*} value The value to check
   * @param {*} message Optional error message
   */
  static async isFalse(value, message) {
    if (value !== false) {
      throw new Error(message || `Expected false, got ${value}`);
    }
  }
}

/**
 * TestResults: Tracks test outcomes and prints a summary.
 */
class TestResults {
  /**
   * Creates a TestResults instance with empty result arrays.
   */
  constructor() {
    this.passed = [];
    this.failed = [];
    this.errors = [];
  }

  /**
   * Records a passing test.
   * @param {*} testName The name of the test that passed
   */
  pass(testName) {
    this.passed.push(testName);
    console.log(`\u2705 PASS: ${testName}`);
  }

  /**
   * Records a failing test.
   * @param {*} testName The name of the test that failed
   * @param {*} reason A description of why the test failed
   */
  fail(testName, reason) {
    this.failed.push({ test: testName, reason });
    console.error(`\u274C FAIL: ${testName}`);
    console.error(`   Reason: ${reason}`);
  }

  /**
   * Records a test that threw an unexpected error.
   * @param {*} testName The name of the test that errored
   * @param {*} error The error that was thrown
   */
  error(testName, error) {
    this.errors.push({ test: testName, error: error.message, stack: error.stack });
    console.error(`\uD83D\uDCA5 ERROR: ${testName}`);
    console.error(`   ${error.message}`);
  }

  /**
   * Prints a summary of all test results to the console.
   * @returns True if all tests passed, false otherwise
   */
  summary() {
    const total = this.passed.length + this.failed.length + this.errors.length;
    console.log('\n' + '\u2550'.repeat(60));
    console.log('TEST SUMMARY');
    console.log('\u2550'.repeat(60));
    console.log(`Total Tests: ${total}`);
    console.log(`\u2705 Passed: ${this.passed.length}`);
    console.log(`\u274C Failed: ${this.failed.length}`);
    console.log(`\uD83D\uDCA5 Errors: ${this.errors.length}`);

    if (this.failed.length > 0) {
      console.log('\nFailed Tests:');
      this.failed.forEach(({ test, reason }) => {
        console.log(`  - ${test}: ${reason}`);
      });
    }

    if (this.errors.length > 0) {
      console.log('\nErrors:');
      this.errors.forEach(({ test, error }) => {
        console.log(`  - ${test}: ${error}`);
      });
    }

    console.log('\u2550'.repeat(60));

    return this.failed.length === 0 && this.errors.length === 0;
  }

  /**
   * Returns a process exit code based on the test results.
   * @returns 0 if all tests passed, 1 otherwise
   */
  exitCode() {
    return this.failed.length === 0 && this.errors.length === 0 ? 0 : 1;
  }
}

/**
 * Waits for a condition function to return true (or a truthy value.)
 * @param {Function} conditionFn Async function that returns truthy value when done
 * @param {number} timeout Maximum time to wait in milliseconds; defaults to 5000
 * @param {number} interval Polling interval in milliseconds; defaults to 250
 * @returns The first truthy result from conditionFn, or null on timeout
 */
async function waitForCondition(conditionFn, timeout = 5000, interval = 250) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = await conditionFn();
      if (result) return result;
    } catch (error) {
      // Condition threw, keep polling
    }
    await sleep(interval);
  }

  return null;
}

/**
 * Launches a Firefox instance with the bridge extension installed.
 * @param {Object} options Configuration options
 * @param {string[]} options.extensions Additional extension paths to install after the bridge (default: [])
 * @param {Function} options.BridgeClass Constructor for the bridge instance (default: TestBridge from this package)
 * @param {boolean} options.headless Run in headless mode (default: reads HEADLESS/MOZ_HEADLESS env vars)
 * @param {number} options.waitForInit Time in ms to wait after each extension install (default: 3000)
 * @param {Object} options.preferences about:config preferences to set (default: {})
 * @returns {{ driver, testBridge, profilePath }}
 */
async function launchBrowser(options = {}) {
  const {
    extensions = [],
    BridgeClass,
    headless = process.env.HEADLESS === '1' || process.env.MOZ_HEADLESS === '1' || false,
    waitForInit = 3000,
    preferences = {},
    firefoxArgs = []
  } = options;

  // Lazy-require to avoid errors when only using simple helpers like sleep()
  const { Builder } = require('selenium-webdriver');
  const firefox = require('selenium-webdriver/firefox');
  const ResolvedBridgeClass = BridgeClass || require('./test-bridge').TestBridge;

  const firefoxOptions = new firefox.Options();

  // Create a unique temporary profile for this browser instance
  const profilePath = path.join(os.tmpdir(), `firefox-test-profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  fs.mkdirSync(profilePath, { recursive: true });

  firefoxOptions.setProfile(profilePath);

  firefoxOptions.setPreference('browser.tabs.warnOnClose', false);
  firefoxOptions.setPreference('browser.warnOnQuit', false);
  firefoxOptions.setPreference('browser.tabs.closeWindowWithLastTab', false);
  firefoxOptions.setPreference('services.sync.engine.tabs', false);
  firefoxOptions.setPreference('services.sync.engine.prefs', false);
  firefoxOptions.addArguments('--new-instance');
  firefoxOptions.addArguments('-no-remote');
  firefoxOptions.setPreference('toolkit.startup.max_resumed_crashes', -1);

  // Apply preferences
  for (const [key, value] of Object.entries(preferences)) {
    firefoxOptions.setPreference(key, value);
  }

  // Apply additional Firefox arguments
  for (const arg of firefoxArgs) {
    firefoxOptions.addArguments(arg);
  }

  if (headless) {
    firefoxOptions.addArguments('-headless');
  }

  try {
    console.log('  Building Firefox driver...');
    const driver = await new Builder()
      .forBrowser('firefox')
      .setFirefoxOptions(firefoxOptions)
      .build();

    console.log('  Driver built successfully');

    await driver.get('about:blank');
    await sleep(500);

    // Install bridge extension
    console.log('  Installing Test Bridge extension...');
    await driver.installAddon(extensionDir, true);

    console.log(`  Waiting ${waitForInit}ms for extension to initialize...`);
    await sleep(waitForInit);

    // Ensure we have a stable window handle
    const handles = await driver.getAllWindowHandles();
    console.log(`  Windows after extension install: ${handles.length}`);

    if (handles.length === 0) {
      console.log('  No windows available, navigating to create one...');
      await driver.get('about:blank');
      await sleep(500);
    } else {
      await driver.switchTo().window(handles[0]);
    }

    // Initialize bridge
    console.log('  Initializing TestBridge...');
    const testBridge = new ResolvedBridgeClass(driver);
    await testBridge.init();

    // Install additional extensions
    for (const ext of extensions) {
      console.log(`  Installing extension: ${path.basename(ext)}...`);
      await driver.installAddon(ext, true);
      console.log(`  Waiting ${waitForInit}ms for extension to initialize...`);
      await sleep(waitForInit);
    }

    console.log('  Browser ready!');
    return { driver, testBridge, profilePath };
  } catch (error) {
    console.error('[launchBrowser] Error:', error.message);
    console.error('[launchBrowser] Stack:', error.stack);

    try {
      if (fs.existsSync(profilePath)) {
        fs.rmSync(profilePath, { recursive: true, force: true });
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    throw error;
  }
}

/**
 * Cleans up a browser instance launched by launchBrowser().
 * @param {Object} browser The object returned by launchBrowser()
 */
async function cleanupBrowser(browser) {
  if (!browser) return;

  try {
    if (browser.driver) {
      await browser.driver.quit();
    }
  } catch (e) {
    console.warn('  Warning: Error quitting driver:', e.message);
  }

  if (browser.profilePath) {
    try {
      if (fs.existsSync(browser.profilePath)) {
        fs.rmSync(browser.profilePath, { recursive: true, force: true });
        console.log(`  Cleaned up profile: ${browser.profilePath}`);
      }
    } catch (e) {
      console.warn(`  Warning: Could not remove profile ${browser.profilePath}:`, e.message);
    }
  }
}

module.exports = {
  sleep,
  generateTestUrl,
  getExtensionUrlForUuid,
  waitForCondition,
  TabUtils,
  Assert,
  TestResults,
  launchBrowser,
  cleanupBrowser,
  extensionDir
};
