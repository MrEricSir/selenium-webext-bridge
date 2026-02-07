/**
 * Test Helpers: Generic utilities for WebExtension Selenium tests.
 */

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

module.exports = {
  sleep,
  generateTestUrl,
  TabUtils,
  Assert,
  TestResults
};
