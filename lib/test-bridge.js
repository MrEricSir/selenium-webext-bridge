/**
 * TestBridge: Selenium wrapper for the WebExt Bridge.
 */

const { sleep, generateTestUrl } = require('./test-helpers');

class TestBridge {
  constructor(driver) {
    this.driver = driver;
    this.ready = false;
  }

  //////////
  // Core //
  //////////

  /**
   * Initialize the test bridge by navigating to a page where it can inject.
   */
  async init() {
    try {
      // Check if we already have a window with TestBridge ready.
      const handles = await this.driver.getAllWindowHandles();

      if (handles.length > 0) {
        // Try existing windows.
        for (const handle of handles) {
          try {
            await this.driver.switchTo().window(handle);
            const hasTestBridge = await this.driver.executeScript(() => {
              return typeof window.TestBridge !== 'undefined';
            });

            if (hasTestBridge) {
              console.log('[TestBridge] Found existing window with TestBridge');
              this.ready = true;
              return;
            }
          } catch (e) {
            // Not a valid window, skip it.
            continue;
          }
        }
      }

      // No existing window with TestBridge so we'll create one.
      const url = generateTestUrl('testbridge-init');
      console.log(`[TestBridge] Navigating to ${url}`);
      await this.driver.get(url);

      // Wait for TestBridge to load.
      await this.driver.wait(async () => {
        try {
          return await this.driver.executeScript(() => {
            return typeof window.TestBridge !== 'undefined';
          });
        } catch (e) {
          return false;
        }
      }, 20000, `[TestBridge] Timed out waiting for the bridge content script to inject on ${url}. ` +
        'Make sure createTestServer() is running (or run your weberver on port 8080).');

      this.ready = true;
    } catch (error) {
      console.error('[TestBridge] Init error:', error.message);
      throw error;
    }
  }

  /**
   * Ensures the test bridge is ready, initializes if not.
   * @throws {Error} If the current page is not an HTTP/HTTPS page.
   */
  async ensureReady() {
    if (!this.ready) {
      await this.init();
      return;
    }

    // Verify the current page can host the bridge content script.
    const currentUrl = await this.driver.getCurrentUrl();
    if (!currentUrl.startsWith('http://') && !currentUrl.startsWith('https://')) {
      this.ready = false;
      throw new Error(
        `[TestBridge] The current page (${currentUrl}) is not an HTTP/HTTPS ` +
        `webpage. Call bridge.init() to re-establish the connection.`
      );
    }
  }

  /**
   * Will respond with "pong" status.
   * @returns Status
   */
  async ping() {
    await this.ensureReady();
    return await this.driver.executeScript(() => {
      return window.TestBridge.ping();
    });
  }

  /**
   * Resets the bridge connection by navigating to an HTTP page and
   * re-initializing. Useful after visiting extension pages or about: pages.
   */
  async reset() {
    const url = generateTestUrl('bridge-reset');
    await this.driver.get(url);
    await sleep(500);
    await this.init();
  }

  /**
   * Takes a screenshot.
   * @param {*} format Optional format; defaults to PNG
   * @returns The requested screenshot
   */
  async captureScreenshot(format) {
    await this.ensureReady();
    return await this.driver.executeScript((f) => {
      return window.TestBridge.captureScreenshot(f);
    }, format);
  }

  /**
   * Returns the UUIDs of all installed extensions from about:config.
   * Navigates away from the current page and marks the bridge as not ready.
   * @returns An object mapping extension IDs to their internal UUIDs
   */
  async _getExtensionUuids() {
    await this.driver.get('about:config');
    await sleep(500);

    // Accept warning (if shown.)
    try {
      await this.driver.executeScript(() => {
        const btn = document.getElementById('warningButton');
        if (btn) btn.click();
      });
      await sleep(300);
    } catch (e) {
      // We expect an error if there's no warning.
    }

    const uuidsJson = await this.driver.executeScript(() => {
      return Services.prefs.getStringPref('extensions.webextensions.uuids', '{}');
    });

    // We navigated away from the bridge page, so mark as not ready.
    this.ready = false;

    return JSON.parse(uuidsJson);
  }

  /**
   * Returns the internal base URL of an installed extension. This is the URL that
   * begins with moz-extension://
   * @param {*} extensionId The extension ID (e.g. 'my-ext@example.com')
   * @returns The moz-extension:// base URL, or null if not found
   */
  async getExtensionUrl(extensionId) {
    const uuids = await this._getExtensionUuids();
    const uuid = uuids[extensionId];
    return uuid ? `moz-extension://${uuid}` : null;
  }

  /**
   * Returns the internal base URL of an installed extension by its manifest name.
   * Useful for extensions that don't declare a fixed ID in their manifest.
   * @param {*} name The extension's name as declared in its manifest.json
   * @returns The moz-extension:// base URL, or null if not found
   */
  async getExtensionUrlByName(name) {
    const uuids = await this._getExtensionUuids();

    for (const [, uuid] of Object.entries(uuids)) {
      const baseUrl = `moz-extension://${uuid}`;
      try {
        await this.driver.get(`${baseUrl}/manifest.json`);
        await sleep(300);
        const pageText = await this.driver.executeScript(() => document.body.textContent);
        const manifest = JSON.parse(pageText);
        if (manifest.name === name) {
          return baseUrl;
        }
      } catch (e) {
        // Not accessible or not valid JSON, try next
      }
    }
    return null;
  }

  /**
   * Clicks an extension's toolbar button.
   * Requires Firefox to be launched with `-remote-allow-system-access`:
   *   launchBrowser({ firefoxArgs: ['-remote-allow-system-access'] })
   * @param {string} extensionId The extension's ID, for example 'my-ext@example.com'
   */
  async clickBrowserAction(extensionId) {
    const { Command } = require('selenium-webdriver/lib/command');

    await this.driver.execute(
      new Command('setContext').setParameter('context', 'chrome')
    );

    try {
      // Open the unified extensions panel (puzzle piece icon.)
      await this.driver.executeScript(() => {
        document.getElementById('unified-extensions-button').click();
      });
      await sleep(500);

      // Click the extension's action button.
      const normalizedId = extensionId.replace(/[@.]/g, '_');
      await this.driver.executeScript((id) => {
        const btn = document.getElementById(id);
        if (!btn) throw new Error(`Extension button "${id}" not found in panel`);
        btn.click();
      }, `${normalizedId}-BAP`);
    } finally {
      await this.driver.execute(
        new Command('setContext').setParameter('context', 'content')
      );
    }
  }

  //////////////////////////
  // Extension Forwarding //
  //////////////////////////

  /**
   * Sends a message to another extension.
   * @param {*} targetExtensionId The ID of the extension to send the message to
   * @param {*} payload The message payload to send
   * @returns The response from the target extension
   */
  async sendToExtension(targetExtensionId, payload) {
    await this.ensureReady();
    return await this.driver.executeScript((target, msg) => {
      return window.TestBridge.forwardToExtension(target, msg);
    }, targetExtensionId, payload);
  }

  /////////////////
  // Tab Queries //
  /////////////////

  /**
   * Gets all available tabs.
   * @return Array of all tabs
   */
  async getTabs() {
    await this.ensureReady();
    return await this.driver.executeScript(() => {
      return window.TestBridge.getTabs();
    });
  }

  /**
   * Gets a single tab based on its ID.
   * @param {*} tabId The ID of a tab, see the results of getTabs()
   * @returns The tab requested.
   */
  async getTabById(tabId) {
    await this.ensureReady();
    return await this.driver.executeScript((id) => {
      return window.TestBridge.getTabById(id);
    }, tabId);
  }

  /**
   * Gets the currently active tab in the current window.
   * @returns The active tab
   */
  async getActiveTab() {
    await this.ensureReady();
    return await this.driver.executeScript(() => {
      return window.TestBridge.getActiveTab();
    });
  }

  /**
   * Gets all tab groups.
   * @returns Array of tab groups, or empty array if not supported
   */
  async getTabGroups() {
    await this.ensureReady();
    return await this.driver.executeScript(() => {
      return window.TestBridge.getTabGroups();
    });
  }

  ///////////////////
  // Tab Lifecycle //
  ///////////////////

  /**
   * Opens a new tab.
   * @param {*} url The URL to open in the new tab
   * @param {*} active Whether the tab should become the active tab
   * @returns The created tab
   */
  async createTab(url, active) {
    await this.ensureReady();
    return await this.driver.executeScript((u, a) => {
      return window.TestBridge.createTab(u, a);
    }, url, active);
  }

  /**
   * Closes a tab.
   * @param {*} tabId The ID of the tab to close
   * @returns Status
   */
  async closeTab(tabId) {
    await this.ensureReady();
    return await this.driver.executeScript((id) => {
      return window.TestBridge.closeTab(id);
    }, tabId);
  }

  /**
   * Updates properties of a tab.
   * @param {*} tabId The ID of the tab to update
   * @param {*} props An object of tab properties to update (e.g. url, active)
   * @returns The updated tab
   */
  async updateTab(tabId, props) {
    await this.ensureReady();
    return await this.driver.executeScript((id, p) => {
      return window.TestBridge.updateTab(id, p);
    }, tabId, props);
  }

  /**
   * Reloads/refreshes a tab.
   * @param {*} tabId The ID of the tab to reload
   * @returns Status
   */
  async reloadTab(tabId) {
    await this.ensureReady();
    return await this.driver.executeScript((id) => {
      return window.TestBridge.reloadTab(id);
    }, tabId);
  }

  ///////////////
  // Tab State //
  ///////////////

  /**
   * Moves a tab to a new position.
   * @param {*} tabId The ID of the tab to move
   * @param {*} index The target index to move the tab to
   * @returns The moved tab
   */
  async moveTab(tabId, index) {
    await this.ensureReady();
    return await this.driver.executeScript((id, idx) => {
      return window.TestBridge.moveTab(id, idx);
    }, tabId, index);
  }

  /**
   * Pins a tab.
   * @param {*} tabId The ID of the tab to pin
   * @returns The pinned tab
   */
  async pinTab(tabId) {
    await this.ensureReady();
    return await this.driver.executeScript((id) => {
      return window.TestBridge.pinTab(id);
    }, tabId);
  }

  /**
   * Unpins a tab.
   * @param {*} tabId The ID of the tab to unpin
   * @returns The unpinned tab
   */
  async unpinTab(tabId) {
    await this.ensureReady();
    return await this.driver.executeScript((id) => {
      return window.TestBridge.unpinTab(id);
    }, tabId);
  }

  /**
   * Mutes a tab.
   * @param {*} tabId The ID of the tab to mute
   * @returns The muted tab
   */
  async muteTab(tabId) {
    await this.ensureReady();
    return await this.driver.executeScript((id) => {
      return window.TestBridge.muteTab(id);
    }, tabId);
  }

  /**
   * Unmutes a tab.
   * @param {*} tabId The ID of the tab to unmute
   * @returns The unmuted tab
   */
  async unmuteTab(tabId) {
    await this.ensureReady();
    return await this.driver.executeScript((id) => {
      return window.TestBridge.unmuteTab(id);
    }, tabId);
  }

  /**
   * Groups tabs together. Can be a new group or an existing one.
   * @param {*} tabIds Array of tab IDs to group
   * @param {*} title The title for the tab group
   * @param {*} color The color for the tab group; defaults to 'blue'
   * @param {*} groupId Optional existing group ID to add tabs to
   * @returns The tab group
   */
  async groupTabs(tabIds, title, color = 'blue', groupId = null) {
    await this.ensureReady();
    return await this.driver.executeScript((ids, t, c, gid) => {
      return window.TestBridge.groupTabs(ids, t, c, gid);
    }, tabIds, title, color, groupId);
  }

  /**
   * Removes tabs from their group.
   * @param {*} tabIds Array of tab IDs to ungroup
   * @returns Status
   */
  async ungroupTabs(tabIds) {
    await this.ensureReady();
    return await this.driver.executeScript((ids) => {
      return window.TestBridge.ungroupTabs(ids);
    }, tabIds);
  }

  //////////////////////////////
  // Tab Execution and Events //
  //////////////////////////////

  /**
   * Executes JavaScript in a specific tab.
   * @param {*} tabId The ID of the tab to execute code in
   * @param {*} code The JavaScript code to execute
   * @returns The execution result, if any
   */
  async executeInTab(tabId, code) {
    await this.ensureReady();
    return await this.driver.executeScript((id, c) => {
      return window.TestBridge.executeInTab(id, c);
    }, tabId, code);
  }

  /**
   * Gets recorded tab events.
   * @param {*} clear Whether to clear the events after retrieving them
   * @returns Array of tab events
   */
  async getTabEvents(clear) {
    await this.ensureReady();
    return await this.driver.executeScript((c) => {
      return window.TestBridge.getTabEvents(c);
    }, clear);
  }

  /////////////////
  // Tab Waiters //
  /////////////////

  /**
   * Waits until the number of open tabs matches the expected count.
   * @param {*} expectedCount The expected number of tabs
   * @param {*} timeout Maximum time to wait in milliseconds; defaults to 10000
   * @returns True if the expected count was reached, false if timed out
   */
  async waitForTabCount(expectedCount, timeout = 10000) {
    const startTime = Date.now();
    let lastCount = -1;

    while (Date.now() - startTime < timeout) {
      try {
        const tabs = await this.getTabs();

        if (tabs.length !== lastCount) {
          console.log(`  [waitForTabCount] Current: ${tabs.length}, Expected: ${expectedCount}`);
          lastCount = tabs.length;
        }

        if (tabs.length === expectedCount) {
          await sleep(2000);
          const verifyTabs = await this.getTabs();
          if (verifyTabs.length === expectedCount) {
            return true;
          }
        }
        await sleep(1000);
      } catch (error) {
        console.log(`  [waitForTabCount] Temporary error: ${error.message}`);
        await sleep(1000);
      }
    }

    return false;
  }

  /**
   * Waits for a tab with a URL matching the given pattern.
   * @param {*} pattern The URL pattern to match
   * @param {*} timeout Maximum time to wait in milliseconds; defaults to 10000
   * @returns The matching tab
   */
  async waitForTabUrl(pattern, timeout = 10000) {
    await this.ensureReady();
    return await this.driver.executeScript((p, t) => {
      return window.TestBridge.waitForTabUrl(p, t);
    }, pattern, timeout);
  }

  /**
   * Waits for a specific tab event type to appear in the event buffer.
   * @param {*} eventType The event type to wait for (e.g. 'created', 'updated', 'removed')
   * @param {*} timeout Maximum time to wait in milliseconds; defaults to 10000
   * @returns The matching event, or null if timed out
   */
  async waitForTabEvent(eventType, timeout = 10000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const events = await this.getTabEvents();
        const match = events.find(e => e.type === eventType);
        if (match) return match;
        await sleep(500);
      } catch (error) {
        console.log(`  [waitForTabEvent] Temporary error: ${error.message}`);
        await sleep(500);
      }
    }

    return null;
  }

  /**
   * Waits for a tab to finish loading.
   * @param {number} tabId The ID of the tab to wait for
   * @param {number} timeout Maximum time to wait in milliseconds; defaults to 10000
   * @returns The tab object once loaded, or null on timeout
   */
  async waitForTabLoad(tabId, timeout = 10000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const tab = await this.getTabById(tabId);
        if (tab && tab.status === 'complete') return tab;
      } catch (e) {
        // Tab may not exist yet, keep polling.
      }
      await sleep(250);
    }

    return null;
  }

  ///////////////////////
  // Window Management //
  ///////////////////////

  /**
   * Gets all open browser windows.
   * @returns Array of all windows
   */
  async getWindows() {
    await this.ensureReady();
    return await this.driver.executeScript(() => {
      return window.TestBridge.getWindows();
    });
  }

  /**
   * Opens a new browser window.
   * @param {*} url The URL to open in the new window
   * @param {*} options Optional window properties (type, state, width, height, left, top)
   * @returns The created window
   */
  async createWindow(url, options) {
    await this.ensureReady();
    return await this.driver.executeScript((u, opts) => {
      return window.TestBridge.createWindow(u, opts);
    }, url, options);
  }

  /**
   * Closes a browser window.
   * @param {*} windowId The ID of the window to close
   * @returns Status
   */
  async closeWindow(windowId) {
    await this.ensureReady();
    return await this.driver.executeScript((id) => {
      return window.TestBridge.closeWindow(id);
    }, windowId);
  }

  /**
   * Gets a single window based on its ID.
   * @param {*} windowId The ID of the window
   * @returns The window requested, with populated tabs
   */
  async getWindowById(windowId) {
    await this.ensureReady();
    return await this.driver.executeScript((id) => {
      return window.TestBridge.getWindowById(id);
    }, windowId);
  }

  /**
   * Updates properties of a window.
   * @param {*} windowId The ID of the window to update
   * @param {*} props An object of window properties to update (e.g. state, width, height, left, top, focused)
   * @returns The updated window
   */
  async updateWindow(windowId, props) {
    await this.ensureReady();
    return await this.driver.executeScript((id, p) => {
      return window.TestBridge.updateWindow(id, p);
    }, windowId, props);
  }

  /////////////////////
  // Window Misc.    //
  /////////////////////

  /**
   * Gets recorded window events.
   * @param {*} clear Whether to clear the events after retrieving them
   * @returns Array of window events
   */
  async getWindowEvents(clear) {
    await this.ensureReady();
    return await this.driver.executeScript((c) => {
      return window.TestBridge.getWindowEvents(c);
    }, clear);
  }

  /**
   * Waits until the number of open windows matches the expected count.
   * @param {*} expectedCount The expected number of windows
   * @param {*} timeout Maximum time to wait in milliseconds; defaults to 10000
   * @returns True if the expected count was reached, false if timed out
   */
  async waitForWindowCount(expectedCount, timeout = 10000) {
    const startTime = Date.now();
    let lastCount = -1;

    while (Date.now() - startTime < timeout) {
      try {
        const windows = await this.getWindows();

        if (windows.length !== lastCount) {
          console.log(`  [waitForWindowCount] Current: ${windows.length}, Expected: ${expectedCount}`);
          lastCount = windows.length;
        }

        if (windows.length === expectedCount) {
          await sleep(2000);
          const verifyWindows = await this.getWindows();
          if (verifyWindows.length === expectedCount) {
            return true;
          }
        }
        await sleep(1000);
      } catch (error) {
        console.log(`  [waitForWindowCount] Temporary error: ${error.message}`);
        await sleep(1000);
      }
    }

    return false;
  }

}

module.exports = { TestBridge };
