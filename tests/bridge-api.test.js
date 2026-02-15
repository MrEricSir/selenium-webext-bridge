#!/usr/bin/env node
/**
 * selenium-webext-bridge — Comprehensive API Test Suite
 *
 * Tests every bridge API and serves as usage documentation.
 * Uses the hello-world example extension as the target extension.
 *
 * Usage:
 *   node bridge-api.test.js
 *
 * Requires: Firefox in PATH, geckodriver, selenium-webdriver
 */

const path = require('path');
const {
  sleep, waitForCondition, createTestServer, TestResults, generateTestUrl,
  launchBrowser, cleanupBrowser
} = require('../');

const HELLO_EXT_DIR = path.join(__dirname, '..', 'examples', 'hello-world', 'extension');
const HELLO_EXT_ID = 'hello-world@example.local';

async function main() {
  console.log('================================================================');
  console.log('  selenium-webext-bridge — API Test Suite');
  console.log('================================================================\n');

  const results = new TestResults();
  const server = await createTestServer({ port: 8080 });
  let browser;

  try {
    // --- Setup ---
    console.log('Setting up Firefox...');
    browser = await launchBrowser({
      extensions: [HELLO_EXT_DIR],
      waitForInit: 2000,
      firefoxArgs: ['-remote-allow-system-access']
    });
    const bridge = browser.testBridge;

    console.log('Setup complete.\n');

    // =============================================================
    // BASICS
    // =============================================================
    console.log('--- Basics ---');

    // ping
    try {
      const pong = await bridge.ping();
      if (pong === 'pong') results.pass('ping() returns "pong"');
      else results.fail('ping() returns "pong"', `got: ${pong}`);
    } catch (e) { results.error('ping() returns "pong"', e); }

    // getTabs
    try {
      const tabs = await bridge.getTabs();
      if (Array.isArray(tabs) && tabs.length >= 1) results.pass('getTabs() returns array of tabs');
      else results.fail('getTabs() returns array of tabs', `got: ${JSON.stringify(tabs)}`);
    } catch (e) { results.error('getTabs() returns array of tabs', e); }

    // =============================================================
    // TAB LIFECYCLE: createTab, getTabById, updateTab, closeTab
    // =============================================================
    console.log('\n--- Tab Lifecycle ---');

    let createdTabId;

    // createTab
    try {
      const tabsBefore = await bridge.getTabs();
      const newTab = await bridge.createTab('http://127.0.0.1:8080/created-tab');
      await sleep(1000);
      const tabsAfter = await bridge.getTabs();
      createdTabId = newTab.id;
      if (tabsAfter.length === tabsBefore.length + 1)
        results.pass('createTab() creates a new tab');
      else
        results.fail('createTab() creates a new tab', `before: ${tabsBefore.length}, after: ${tabsAfter.length}`);
    } catch (e) { results.error('createTab() creates a new tab', e); }

    // getTabById
    try {
      const tab = await bridge.getTabById(createdTabId);
      if (tab && tab.id === createdTabId)
        results.pass('getTabById() returns correct tab');
      else
        results.fail('getTabById() returns correct tab', `got: ${JSON.stringify(tab)}`);
    } catch (e) { results.error('getTabById() returns correct tab', e); }

    // updateTab — navigate to new URL
    try {
      const updated = await bridge.updateTab(createdTabId, { url: 'http://127.0.0.1:8080/updated-tab' });
      await sleep(1500);
      const tab = await bridge.getTabById(createdTabId);
      if (tab.url.includes('updated-tab'))
        results.pass('updateTab() navigates tab to new URL');
      else
        results.fail('updateTab() navigates tab to new URL', `url: ${tab.url}`);
    } catch (e) { results.error('updateTab() navigates tab to new URL', e); }

    // closeTab
    try {
      const tabsBefore = await bridge.getTabs();
      await bridge.closeTab(createdTabId);
      await sleep(500);
      const tabsAfter = await bridge.getTabs();
      if (tabsAfter.length === tabsBefore.length - 1)
        results.pass('closeTab() removes the tab');
      else
        results.fail('closeTab() removes the tab', `before: ${tabsBefore.length}, after: ${tabsAfter.length}`);
    } catch (e) { results.error('closeTab() removes the tab', e); }

    // =============================================================
    // TAB STATE: pinTab, unpinTab, moveTab, muteTab, unmuteTab
    // =============================================================
    console.log('\n--- Tab State ---');

    let stateTabId;

    // Create a tab to work with
    try {
      const tab = await bridge.createTab('http://127.0.0.1:8080/state-test');
      stateTabId = tab.id;
      await sleep(1000);
    } catch (e) { /* will fail subsequent tests */ }

    // pinTab
    try {
      await bridge.pinTab(stateTabId);
      const tab = await bridge.getTabById(stateTabId);
      if (tab.pinned)
        results.pass('pinTab() pins the tab');
      else
        results.fail('pinTab() pins the tab', `pinned: ${tab.pinned}`);
    } catch (e) { results.error('pinTab() pins the tab', e); }

    // unpinTab
    try {
      await bridge.unpinTab(stateTabId);
      const tab = await bridge.getTabById(stateTabId);
      if (!tab.pinned)
        results.pass('unpinTab() unpins the tab');
      else
        results.fail('unpinTab() unpins the tab', `pinned: ${tab.pinned}`);
    } catch (e) { results.error('unpinTab() unpins the tab', e); }

    // moveTab
    try {
      await bridge.moveTab(stateTabId, 0);
      const tab = await bridge.getTabById(stateTabId);
      if (tab.index === 0)
        results.pass('moveTab() moves tab to index 0');
      else
        results.fail('moveTab() moves tab to index 0', `index: ${tab.index}`);
    } catch (e) { results.error('moveTab() moves tab to index 0', e); }

    // muteTab
    try {
      await bridge.muteTab(stateTabId);
      const tab = await bridge.getTabById(stateTabId);
      if (tab.mutedInfo && tab.mutedInfo.muted)
        results.pass('muteTab() mutes the tab');
      else
        results.fail('muteTab() mutes the tab', `mutedInfo: ${JSON.stringify(tab.mutedInfo)}`);
    } catch (e) { results.error('muteTab() mutes the tab', e); }

    // unmuteTab
    try {
      await bridge.unmuteTab(stateTabId);
      const tab = await bridge.getTabById(stateTabId);
      if (tab.mutedInfo && !tab.mutedInfo.muted)
        results.pass('unmuteTab() unmutes the tab');
      else
        results.fail('unmuteTab() unmutes the tab', `mutedInfo: ${JSON.stringify(tab.mutedInfo)}`);
    } catch (e) { results.error('unmuteTab() unmutes the tab', e); }

    // Clean up state tab
    try { await bridge.closeTab(stateTabId); await sleep(300); } catch (e) {}

    // =============================================================
    // TAB CONVENIENCE: reloadTab, getActiveTab, getTabGroups
    // =============================================================
    console.log('\n--- Tab Convenience ---');

    // reloadTab — modify DOM, reload, verify reset
    try {
      const tab = await bridge.createTab('http://127.0.0.1:8080/reload-test');
      await sleep(1500);
      await bridge.executeInTab(tab.id, 'document.title = "BEFORE_RELOAD"');
      const titleBefore = await bridge.executeInTab(tab.id, 'document.title');
      await bridge.reloadTab(tab.id);
      await sleep(1500);
      const titleAfter = await bridge.executeInTab(tab.id, 'document.title');
      if (titleBefore === 'BEFORE_RELOAD' && titleAfter !== 'BEFORE_RELOAD')
        results.pass('reloadTab() reloads the tab');
      else
        results.fail('reloadTab() reloads the tab', `before: ${titleBefore}, after: ${titleAfter}`);
      await bridge.closeTab(tab.id);
      await sleep(300);
    } catch (e) { results.error('reloadTab() reloads the tab', e); }

    // getActiveTab
    try {
      const activeTab = await bridge.getActiveTab();
      if (activeTab && activeTab.active === true)
        results.pass('getActiveTab() returns the active tab');
      else
        results.fail('getActiveTab() returns the active tab', `got: ${JSON.stringify(activeTab)}`);
    } catch (e) { results.error('getActiveTab() returns the active tab', e); }

    // getTabGroups
    try {
      const groups = await bridge.getTabGroups();
      if (Array.isArray(groups))
        results.pass('getTabGroups() returns an array');
      else
        results.fail('getTabGroups() returns an array', `got: ${JSON.stringify(groups)}`);
    } catch (e) { results.error('getTabGroups() returns an array', e); }

    // =============================================================
    // TAB WAITING: waitForTabCount, waitForTabUrl, waitForTabEvent
    // =============================================================
    console.log('\n--- Tab Waiting ---');

    // waitForTabUrl — create a tab then wait for its URL
    try {
      const marker = `wait-url-${Date.now()}`;
      // Create the tab async — waitForTabUrl should find it
      bridge.createTab(`http://127.0.0.1:8080/${marker}`);
      await sleep(200); // small delay so createTab fires
      const found = await bridge.waitForTabUrl(marker, 10000);
      if (found && found.url && found.url.includes(marker))
        results.pass('waitForTabUrl() finds tab matching pattern');
      else
        results.fail('waitForTabUrl() finds tab matching pattern', `got: ${JSON.stringify(found)}`);
      // Clean up
      if (found) { try { await bridge.closeTab(found.id); await sleep(300); } catch(e) {} }
    } catch (e) { results.error('waitForTabUrl() finds tab matching pattern', e); }

    // waitForTabUrl — timeout returns null
    try {
      const found = await bridge.waitForTabUrl('this-url-does-not-exist-xyz', 1000);
      if (found === null)
        results.pass('waitForTabUrl() returns null on timeout');
      else
        results.fail('waitForTabUrl() returns null on timeout', `got: ${JSON.stringify(found)}`);
    } catch (e) { results.error('waitForTabUrl() returns null on timeout', e); }

    // waitForTabEvent — create a tab and wait for the 'created' event
    try {
      // Clear existing events
      await bridge.getTabEvents(true);
      const tab = await bridge.createTab('http://127.0.0.1:8080/wait-event-test');
      const event = await bridge.waitForTabEvent('created', 10000);
      if (event && event.type === 'created')
        results.pass('waitForTabEvent() finds matching event');
      else
        results.fail('waitForTabEvent() finds matching event', `got: ${JSON.stringify(event)}`);
      await bridge.closeTab(tab.id);
      await sleep(300);
    } catch (e) { results.error('waitForTabEvent() finds matching event', e); }

    // waitForTabEvent — timeout returns null
    try {
      await bridge.getTabEvents(true);
      const event = await bridge.waitForTabEvent('removed', 1000);
      if (event === null)
        results.pass('waitForTabEvent() returns null on timeout');
      else
        results.fail('waitForTabEvent() returns null on timeout', `got: ${JSON.stringify(event)}`);
    } catch (e) { results.error('waitForTabEvent() returns null on timeout', e); }

    // =============================================================
    // EXECUTE IN TAB
    // =============================================================
    console.log('\n--- Execute in Tab ---');

    try {
      // Create a tab and run JS in it
      const tab = await bridge.createTab('http://127.0.0.1:8080/exec-test');
      await sleep(1500); // wait for page load
      const result = await bridge.executeInTab(tab.id, 'document.title');
      if (typeof result === 'string' && result.length > 0)
        results.pass('executeInTab() runs JS and returns result');
      else
        results.fail('executeInTab() runs JS and returns result', `got: ${JSON.stringify(result)}`);
      await bridge.closeTab(tab.id);
      await sleep(300);
    } catch (e) { results.error('executeInTab() runs JS and returns result', e); }

    // executeInTab — modify DOM
    try {
      const tab = await bridge.createTab('http://127.0.0.1:8080/exec-modify');
      await sleep(1500);
      await bridge.executeInTab(tab.id, 'document.title = "MODIFIED"');
      const title = await bridge.executeInTab(tab.id, 'document.title');
      if (title === 'MODIFIED')
        results.pass('executeInTab() can modify page state');
      else
        results.fail('executeInTab() can modify page state', `title: ${title}`);
      await bridge.closeTab(tab.id);
      await sleep(300);
    } catch (e) { results.error('executeInTab() can modify page state', e); }

    // =============================================================
    // SCREENSHOTS
    // =============================================================
    console.log('\n--- Screenshots ---');

    try {
      const dataUrl = await bridge.captureScreenshot();
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/png'))
        results.pass('captureScreenshot() returns PNG data URL');
      else
        results.fail('captureScreenshot() returns PNG data URL', `starts with: ${String(dataUrl).substring(0, 30)}`);
    } catch (e) { results.error('captureScreenshot() returns PNG data URL', e); }

    // =============================================================
    // WINDOW MANAGEMENT
    // =============================================================
    console.log('\n--- Window Management ---');

    let newWindowId;

    // getWindows — baseline
    try {
      const windows = await bridge.getWindows();
      if (Array.isArray(windows) && windows.length >= 1)
        results.pass('getWindows() returns array of windows');
      else
        results.fail('getWindows() returns array of windows', `got: ${JSON.stringify(windows)}`);
    } catch (e) { results.error('getWindows() returns array of windows', e); }

    // createWindow
    try {
      const windowsBefore = await bridge.getWindows();
      const win = await bridge.createWindow('http://127.0.0.1:8080/new-window');
      newWindowId = win.id;
      await sleep(1500);
      const windowsAfter = await bridge.getWindows();
      if (windowsAfter.length === windowsBefore.length + 1)
        results.pass('createWindow() opens a new window');
      else
        results.fail('createWindow() opens a new window', `before: ${windowsBefore.length}, after: ${windowsAfter.length}`);
    } catch (e) { results.error('createWindow() opens a new window', e); }

    // getWindowById
    try {
      const win = await bridge.getWindowById(newWindowId);
      if (win && win.id === newWindowId)
        results.pass('getWindowById() returns correct window');
      else
        results.fail('getWindowById() returns correct window', `got: ${JSON.stringify(win)}`);
    } catch (e) { results.error('getWindowById() returns correct window', e); }

    // updateWindow — resize
    try {
      const updated = await bridge.updateWindow(newWindowId, { width: 800, height: 600 });
      await sleep(500);
      const win = await bridge.getWindowById(newWindowId);
      if (win.width === 800 && win.height === 600)
        results.pass('updateWindow() resizes the window');
      else
        results.fail('updateWindow() resizes the window', `width: ${win.width}, height: ${win.height}`);
    } catch (e) { results.error('updateWindow() resizes the window', e); }

    // closeWindow
    try {
      const windowsBefore = await bridge.getWindows();
      await bridge.closeWindow(newWindowId);
      await sleep(500);
      const windowsAfter = await bridge.getWindows();
      if (windowsAfter.length === windowsBefore.length - 1)
        results.pass('closeWindow() closes the window');
      else
        results.fail('closeWindow() closes the window', `before: ${windowsBefore.length}, after: ${windowsAfter.length}`);
    } catch (e) { results.error('closeWindow() closes the window', e); }

    // createWindow with options
    try {
      const win = await bridge.createWindow('http://127.0.0.1:8080/sized-window', { width: 640, height: 480 });
      await sleep(1000);
      const fetched = await bridge.getWindowById(win.id);
      if (fetched.width === 640 && fetched.height === 480)
        results.pass('createWindow() with options sets dimensions');
      else
        results.fail('createWindow() with options sets dimensions', `width: ${fetched.width}, height: ${fetched.height}`);
      await bridge.closeWindow(win.id);
      await sleep(500);
    } catch (e) { results.error('createWindow() with options sets dimensions', e); }

    // waitForWindowCount
    try {
      const windowsBefore = await bridge.getWindows();
      const expectedCount = windowsBefore.length + 1;
      bridge.createWindow('http://127.0.0.1:8080/wait-window-test');
      const reached = await bridge.waitForWindowCount(expectedCount, 10000);
      if (reached)
        results.pass('waitForWindowCount() resolves when count matches');
      else
        results.fail('waitForWindowCount() resolves when count matches', 'timed out');
      // Clean up
      const windowsAfter = await bridge.getWindows();
      const extraWindows = windowsAfter.filter(w => !windowsBefore.find(b => b.id === w.id));
      for (const w of extraWindows) {
        try { await bridge.closeWindow(w.id); await sleep(300); } catch (e) {}
      }
    } catch (e) { results.error('waitForWindowCount() resolves when count matches', e); }

    // =============================================================
    // TAB EVENTS
    // =============================================================
    console.log('\n--- Tab Events ---');

    try {
      // Clear any existing events from earlier tests
      await bridge.getTabEvents(true);

      // Generate some events
      const tab = await bridge.createTab('http://127.0.0.1:8080/event-test');
      await sleep(1000);
      await bridge.closeTab(tab.id);
      await sleep(500);

      // Read events
      const events = await bridge.getTabEvents();
      const createdEvents = events.filter(e => e.type === 'created');
      const removedEvents = events.filter(e => e.type === 'removed');

      if (createdEvents.length >= 1 && removedEvents.length >= 1)
        results.pass('getTabEvents() captures created and removed events');
      else
        results.fail('getTabEvents() captures created and removed events',
          `created: ${createdEvents.length}, removed: ${removedEvents.length}`);
    } catch (e) { results.error('getTabEvents() captures created and removed events', e); }

    // getTabEvents with clear
    try {
      // Events should still be there from above
      const events = await bridge.getTabEvents(true);
      if (events.length >= 1) {
        // Buffer should now be empty
        const after = await bridge.getTabEvents();
        if (after.length === 0)
          results.pass('getTabEvents(clear=true) clears the buffer');
        else
          results.fail('getTabEvents(clear=true) clears the buffer', `still ${after.length} events`);
      } else {
        results.fail('getTabEvents(clear=true) clears the buffer', 'no events to clear');
      }
    } catch (e) { results.error('getTabEvents(clear=true) clears the buffer', e); }

    // =============================================================
    // WINDOW EVENTS
    // =============================================================
    console.log('\n--- Window Events ---');

    try {
      // Clear any existing window events
      await bridge.getWindowEvents(true);

      // Generate some events
      const win = await bridge.createWindow('http://127.0.0.1:8080/window-event-test');
      await sleep(1000);
      await bridge.closeWindow(win.id);
      await sleep(500);

      // Read events
      const events = await bridge.getWindowEvents();
      const createdEvents = events.filter(e => e.type === 'created');
      const removedEvents = events.filter(e => e.type === 'removed');

      if (createdEvents.length >= 1 && removedEvents.length >= 1)
        results.pass('getWindowEvents() captures created and removed events');
      else
        results.fail('getWindowEvents() captures created and removed events',
          `created: ${createdEvents.length}, removed: ${removedEvents.length}`);
    } catch (e) { results.error('getWindowEvents() captures created and removed events', e); }

    // getWindowEvents with clear
    try {
      const events = await bridge.getWindowEvents(true);
      if (events.length >= 1) {
        const after = await bridge.getWindowEvents();
        if (after.length === 0)
          results.pass('getWindowEvents(clear=true) clears the buffer');
        else
          results.fail('getWindowEvents(clear=true) clears the buffer', `still ${after.length} events`);
      } else {
        results.fail('getWindowEvents(clear=true) clears the buffer', 'no events to clear');
      }
    } catch (e) { results.error('getWindowEvents(clear=true) clears the buffer', e); }

    // =============================================================
    // WAIT HELPERS: waitForCondition (bridge method + standalone)
    // =============================================================
    console.log('\n--- Wait Helpers ---');

    // waitForCondition — condition becomes true
    try {
      let counter = 0;
      const result = await waitForCondition(async () => {
        counter++;
        return counter >= 3 ? 'done' : false;
      }, 5000, 100);
      if (result === 'done' && counter >= 3)
        results.pass('waitForCondition() resolves when condition is truthy');
      else
        results.fail('waitForCondition() resolves when condition is truthy', `result: ${result}, counter: ${counter}`);
    } catch (e) { results.error('waitForCondition() resolves when condition is truthy', e); }

    // waitForCondition — timeout returns null
    try {
      const result = await waitForCondition(async () => false, 500, 100);
      if (result === null)
        results.pass('waitForCondition() returns null on timeout');
      else
        results.fail('waitForCondition() returns null on timeout', `got: ${result}`);
    } catch (e) { results.error('waitForCondition() returns null on timeout', e); }

    // waitForCondition — swallows errors and keeps polling
    try {
      let callCount = 0;
      const result = await waitForCondition(async () => {
        callCount++;
        if (callCount < 3) throw new Error('not yet');
        return 'recovered';
      }, 5000, 100);
      if (result === 'recovered')
        results.pass('waitForCondition() recovers from errors in conditionFn');
      else
        results.fail('waitForCondition() recovers from errors in conditionFn', `got: ${result}`);
    } catch (e) { results.error('waitForCondition() recovers from errors in conditionFn', e); }

    // waitForCondition — works with bridge methods
    try {
      const tab = await bridge.createTab('http://127.0.0.1:8080/wait-condition-test');
      await sleep(500);
      const result = await waitForCondition(async () => {
        const tabs = await bridge.getTabs();
        return tabs.find(t => t.url && t.url.includes('wait-condition-test'));
      }, 10000, 500);
      if (result && result.url && result.url.includes('wait-condition-test'))
        results.pass('waitForCondition() works with bridge methods');
      else
        results.fail('waitForCondition() works with bridge methods', `got: ${JSON.stringify(result)}`);
      await bridge.closeTab(tab.id);
      await sleep(300);
    } catch (e) { results.error('waitForCondition() works with bridge methods', e); }

    // waitForCondition — custom interval
    try {
      let calls = 0;
      const start = Date.now();
      const result = await waitForCondition(async () => {
        calls++;
        return calls >= 3 ? true : false;
      }, 5000, 50);
      const elapsed = Date.now() - start;
      if (result === true && elapsed < 500)
        results.pass('waitForCondition() respects custom interval');
      else
        results.fail('waitForCondition() respects custom interval', `elapsed: ${elapsed}ms, calls: ${calls}`);
    } catch (e) { results.error('waitForCondition() respects custom interval', e); }

    // waitForCondition — returns first truthy value (not just true)
    try {
      const result = await waitForCondition(async () => {
        return { found: true, data: 42 };
      }, 5000, 100);
      if (result && result.found === true && result.data === 42)
        results.pass('waitForCondition() returns the truthy value, not just true');
      else
        results.fail('waitForCondition() returns the truthy value, not just true', `got: ${JSON.stringify(result)}`);
    } catch (e) { results.error('waitForCondition() returns the truthy value, not just true', e); }

    // =============================================================
    // EXTENSION FORWARDING (using hello-world extension)
    // =============================================================
    console.log('\n--- Extension Forwarding ---');

    // ping
    try {
      const resp = await bridge.sendToExtension(HELLO_EXT_ID, { action: 'ping' });
      if (resp && resp.data === 'hello world')
        results.pass('sendToExtension() ping returns "hello world"');
      else
        results.fail('sendToExtension() ping returns "hello world"', `got: ${JSON.stringify(resp)}`);
    } catch (e) { results.error('sendToExtension() ping returns "hello world"', e); }

    // greet
    try {
      const resp = await bridge.sendToExtension(HELLO_EXT_ID, { action: 'greet', name: 'Tester' });
      if (resp && resp.data === 'Hello, Tester!')
        results.pass('sendToExtension() greet returns personalized message');
      else
        results.fail('sendToExtension() greet returns personalized message', `got: ${JSON.stringify(resp)}`);
    } catch (e) { results.error('sendToExtension() greet returns personalized message', e); }

    // counter: increment + getCounter
    try {
      await bridge.sendToExtension(HELLO_EXT_ID, { action: 'increment' });
      await bridge.sendToExtension(HELLO_EXT_ID, { action: 'increment' });
      await bridge.sendToExtension(HELLO_EXT_ID, { action: 'increment' });
      const resp = await bridge.sendToExtension(HELLO_EXT_ID, { action: 'getCounter' });
      if (resp && resp.data === 3)
        results.pass('sendToExtension() counter increments correctly');
      else
        results.fail('sendToExtension() counter increments correctly', `got: ${JSON.stringify(resp)}`);
    } catch (e) { results.error('sendToExtension() counter increments correctly', e); }

    // unknown action
    try {
      const resp = await bridge.sendToExtension(HELLO_EXT_ID, { action: 'nonexistent' });
      if (resp && resp.success === false)
        results.pass('sendToExtension() returns error for unknown action');
      else
        results.fail('sendToExtension() returns error for unknown action', `got: ${JSON.stringify(resp)}`);
    } catch (e) { results.error('sendToExtension() returns error for unknown action', e); }

    // =============================================================
    // EXTENSION URL + CONTEXT DETECTION
    // =============================================================
    console.log('\n--- Extension URL + Context Detection ---');

    // Returns moz-extension:// URL if the extension is found.
    try {
      const url = await bridge.getExtensionUrl(HELLO_EXT_ID);
      if (typeof url === 'string' && url.startsWith('moz-extension://'))
        results.pass('getExtensionUrl() returns moz-extension:// URL');
      else
        results.fail('getExtensionUrl() returns moz-extension:// URL', `got: ${url}`);
    } catch (e) { results.error('getExtensionUrl() returns moz-extension:// URL', e); }

    // Returns null if not found (for example, not installed)
    try {
      const url = await bridge.getExtensionUrl('nonexistent@example.com');
      if (url === null)
        results.pass('getExtensionUrl() returns null for unknown extension');
      else
        results.fail('getExtensionUrl() returns null for unknown extension', `got: ${url}`);
    } catch (e) { results.error('getExtensionUrl() returns null for unknown extension', e); }

    // After getExtensionUrl(), bridge auto-recovers on next call
    try {
      const pong = await bridge.ping();
      if (pong === 'pong')
        results.pass('Bridge auto-recovers after getExtensionUrl()');
      else
        results.fail('Bridge auto-recovers after getExtensionUrl()', `got: ${pong}`);
    } catch (e) { results.error('Bridge auto-recovers after getExtensionUrl()', e); }

    // getExtensionUrlByName() returns moz-extension:// URL
    try {
      const url = await bridge.getExtensionUrlByName('Hello World Extension');
      if (typeof url === 'string' && url.startsWith('moz-extension://'))
        results.pass('getExtensionUrlByName() returns moz-extension:// URL');
      else
        results.fail('getExtensionUrlByName() returns moz-extension:// URL', `got: ${url}`);
    } catch (e) { results.error('getExtensionUrlByName() returns moz-extension:// URL', e); }

    // getExtensionUrlByName() returns null for unknown name
    try {
      const url = await bridge.getExtensionUrlByName('Nonexistent Extension');
      if (url === null)
        results.pass('getExtensionUrlByName() returns null for unknown name');
      else
        results.fail('getExtensionUrlByName() returns null for unknown name', `got: ${url}`);
    } catch (e) { results.error('getExtensionUrlByName() returns null for unknown name', e); }

    // After getExtensionUrlByName(), bridge auto-recovers on next call
    try {
      const pong = await bridge.ping();
      if (pong === 'pong')
        results.pass('Bridge auto-recovers after getExtensionUrlByName()');
      else
        results.fail('Bridge auto-recovers after getExtensionUrlByName()', `got: ${pong}`);
    } catch (e) { results.error('Bridge auto-recovers after getExtensionUrlByName()', e); }

    // ensureReady() throws when on a non-HTTP page
    try {
      await browser.driver.get('about:blank');
      await sleep(500);
      try {
        await bridge.ping();
        results.fail('ensureReady() throws on non-HTTP page', 'no error thrown');
      } catch (err) {
        if (err.message.includes('not an HTTP'))
          results.pass('ensureReady() throws on non-HTTP page');
        else
          results.fail('ensureReady() throws on non-HTTP page', `wrong error: ${err.message}`);
      }
    } catch (e) { results.error('ensureReady() throws on non-HTTP page', e); }

    // After the error, bridge.init() + ping() recovers
    try {
      await bridge.init();
      const pong = await bridge.ping();
      if (pong === 'pong')
        results.pass('Bridge recovers after init() following non-HTTP error');
      else
        results.fail('Bridge recovers after init() following non-HTTP error', `got: ${pong}`);
    } catch (e) { results.error('Bridge recovers after init() following non-HTTP error', e); }

    // =============================================================
    // BRIDGE RESET
    // =============================================================
    console.log('\n--- Bridge Reset ---');

    // reset() recovers after navigating to extension page
    try {
      const extUrl = await bridge.getExtensionUrl(HELLO_EXT_ID);
      await browser.driver.get(extUrl + '/manifest.json');
      await sleep(500);

      await bridge.reset();
      const pong = await bridge.ping();
      if (pong === 'pong')
        results.pass('reset() recovers after extension page');
      else
        results.fail('reset() recovers after extension page', `got: ${pong}`);
    } catch (e) { results.error('reset() recovers after extension page', e); }

    // reset() recovers after about:blank
    try {
      await browser.driver.get('about:blank');
      await sleep(500);

      await bridge.reset();
      const pong = await bridge.ping();
      if (pong === 'pong')
        results.pass('reset() recovers after about:blank');
      else
        results.fail('reset() recovers after about:blank', `got: ${pong}`);
    } catch (e) { results.error('reset() recovers after about:blank', e); }

    // reset() is a no-op when already on an HTTP page
    try {
      const tabsBefore = await bridge.getTabs();
      await bridge.reset();
      const pong = await bridge.ping();
      if (pong === 'pong')
        results.pass('reset() works when already on HTTP page');
      else
        results.fail('reset() works when already on HTTP page', `got: ${pong}`);
    } catch (e) { results.error('reset() works when already on HTTP page', e); }

    // =============================================================
    // WAIT FOR TAB LOAD
    // =============================================================
    console.log('\n--- Wait For Tab Load ---');

    // waitForTabLoad() returns loaded tab
    try {
      const tab = await bridge.createTab('http://127.0.0.1:8080/load-wait-test');
      const loaded = await bridge.waitForTabLoad(tab.id, 10000);
      if (loaded && loaded.status === 'complete' && loaded.id === tab.id)
        results.pass('waitForTabLoad() returns tab when loaded');
      else
        results.fail('waitForTabLoad() returns tab when loaded', `got: ${JSON.stringify(loaded)}`);
      await bridge.closeTab(tab.id);
      await sleep(300);
    } catch (e) { results.error('waitForTabLoad() returns tab when loaded', e); }

    // waitForTabLoad() returns null on timeout for nonexistent tab
    try {
      const result = await bridge.waitForTabLoad(999999, 1000);
      if (result === null)
        results.pass('waitForTabLoad() returns null on timeout');
      else
        results.fail('waitForTabLoad() returns null on timeout', `got: ${JSON.stringify(result)}`);
    } catch (e) { results.error('waitForTabLoad() returns null on timeout', e); }

    // waitForTabLoad() can replace sleep() after createTab()
    try {
      const tab = await bridge.createTab('http://127.0.0.1:8080/no-sleep-needed');
      const loaded = await bridge.waitForTabLoad(tab.id);
      const title = await bridge.executeInTab(loaded.id, 'document.readyState');
      if (title === 'complete')
        results.pass('waitForTabLoad() + executeInTab() works without sleep()');
      else
        results.fail('waitForTabLoad() + executeInTab() works without sleep()', `readyState: ${title}`);
      await bridge.closeTab(tab.id);
      await sleep(300);
    } catch (e) { results.error('waitForTabLoad() + executeInTab() works without sleep()', e); }

    // =============================================================
    // CLICK BROWSER ACTION
    // =============================================================
    console.log('\n--- Click Browser Action ---');

    // clickBrowserAction() triggers the hello-world extension's action
    try {
      // The hello-world extension increments a counter on action click.
      const before = await bridge.sendToExtension(HELLO_EXT_ID, { action: 'getCounter' });
      const counterBefore = before.data;

      await bridge.clickBrowserAction(HELLO_EXT_ID);
      await sleep(500);
      await bridge.reset();

      const after = await bridge.sendToExtension(HELLO_EXT_ID, { action: 'getCounter' });
      if (after.data === counterBefore + 1)
        results.pass('clickBrowserAction() triggers extension action');
      else
        results.fail('clickBrowserAction() triggers extension action',
          `counter before: ${counterBefore}, after: ${after.data}`);
    } catch (e) { results.error('clickBrowserAction() triggers extension action', e); }

    // clickBrowserAction() throws for nonexistent extension
    try {
      try {
        await bridge.clickBrowserAction('nonexistent@example.com');
        results.fail('clickBrowserAction() throws for nonexistent extension', 'no error thrown');
      } catch (err) {
        if (err.message.includes('not found'))
          results.pass('clickBrowserAction() throws for nonexistent extension');
        else
          results.fail('clickBrowserAction() throws for nonexistent extension', `wrong error: ${err.message}`);
      }
    } catch (e) { results.error('clickBrowserAction() throws for nonexistent extension', e); }

    // Bridge recovers after clickBrowserAction()
    try {
      await bridge.reset();
      const pong = await bridge.ping();
      if (pong === 'pong')
        results.pass('Bridge recovers after clickBrowserAction()');
      else
        results.fail('Bridge recovers after clickBrowserAction()', `got: ${pong}`);
    } catch (e) { results.error('Bridge recovers after clickBrowserAction()', e); }

  } catch (e) {
    results.error('Test Suite', e);
  } finally {
    await cleanupBrowser(browser);
    server.close();
  }

  console.log('');
  const allPassed = results.summary();
  process.exit(results.exitCode());
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
