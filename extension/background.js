/**
 * Selenium WebExt Bridge - Background Script
 *
 * Provides WebExtension API access to Selenium tests
 */

console.log('[BRIDGE] Background script loading...');

try {

// Get our own extension URL for UUID detection
const TEST_API_URL = browser.runtime.getURL('test-api.html');
const TEST_BRIDGE_UUID = TEST_API_URL.match(/moz-extension:\/\/([^\/]+)/)?.[1];
console.log('[BRIDGE] Test API URL:', TEST_API_URL);
console.log('[BRIDGE] UUID:', TEST_BRIDGE_UUID);

// Inject UUID into all pages when they load
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Only inject when page is loaded and it's a regular page
    if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('about:') && !tab.url.startsWith('moz-extension:')) {
        try {
            await browser.tabs.executeScript(tabId, {
                code: `
                    window.__TEST_BRIDGE_UUID = ${JSON.stringify(TEST_BRIDGE_UUID)};
                    window.__TEST_BRIDGE_URL = ${JSON.stringify(TEST_API_URL)};
                    console.log('[BRIDGE] UUID injected:', window.__TEST_BRIDGE_UUID);
                `,
                runAt: 'document_start'
            });
        } catch (error) {
            // Ignore errors (e.g., privileged pages)
        }
    }
});

// --- Tab Event Buffer ---
const TAB_EVENT_BUFFER_SIZE = 100;
const tabEventBuffer = [];

function pushTabEvent(event) {
  tabEventBuffer.push(event);
  if (tabEventBuffer.length > TAB_EVENT_BUFFER_SIZE) {
    tabEventBuffer.shift();
  }
}

browser.tabs.onCreated.addListener((tab) => {
  pushTabEvent({ type: 'created', tab, timestamp: Date.now() });
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  pushTabEvent({ type: 'updated', tabId, changeInfo, tab, timestamp: Date.now() });
});

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
  pushTabEvent({ type: 'removed', tabId, removeInfo, timestamp: Date.now() });
});

// --- Window Event Buffer ---
const WINDOW_EVENT_BUFFER_SIZE = 100;
const windowEventBuffer = [];

function pushWindowEvent(event) {
  windowEventBuffer.push(event);
  if (windowEventBuffer.length > WINDOW_EVENT_BUFFER_SIZE) {
    windowEventBuffer.shift();
  }
}

browser.windows.onCreated.addListener((window) => {
  pushWindowEvent({ type: 'created', window, timestamp: Date.now() });
});

browser.windows.onRemoved.addListener((windowId) => {
  pushWindowEvent({ type: 'removed', windowId, timestamp: Date.now() });
});

// --- Message Handler ---
console.log('[BRIDGE] Registering message listener...');
browser.runtime.onMessage.addListener(async (message, sender) => {
  try {
    switch (message.action) {
      // --- Existing APIs ---

      case 'getTabs':
        const tabs = await browser.tabs.query({});
        return { success: true, data: tabs };

      case 'getTabGroups':
        if (browser.tabGroups) {
          const groups = await browser.tabGroups.query({});
          return { success: true, data: groups };
        } else {
          return { success: true, data: [] };
        }

      case 'ping':
        return { success: true, data: 'pong' };

      case 'moveTab':
        const movedTab = await browser.tabs.move(message.tabId, { index: message.index });
        return { success: true, data: movedTab };

      case 'pinTab':
        const pinnedTab = await browser.tabs.update(message.tabId, { pinned: true });
        return { success: true, data: pinnedTab };

      case 'unpinTab':
        const unpinnedTab = await browser.tabs.update(message.tabId, { pinned: false });
        return { success: true, data: unpinnedTab };

      case 'muteTab': {
        const mutedTab = await browser.tabs.update(message.tabId, { muted: true });
        return { success: true, data: mutedTab };
      }

      case 'unmuteTab': {
        const unmutedTab = await browser.tabs.update(message.tabId, { muted: false });
        return { success: true, data: unmutedTab };
      }

      case 'reloadTab': {
        await browser.tabs.reload(message.tabId);
        return { success: true, data: null };
      }

      case 'getActiveTab': {
        const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });
        return { success: true, data: activeTabs[0] || null };
      }

      case 'groupTabs':
        if (!browser.tabGroups) {
          return { success: false, error: 'Tab Groups API not available' };
        }
        try {
          let groupId = message.groupId;
          if (!groupId || groupId === -1) {
            groupId = await browser.tabs.group({ tabIds: message.tabIds });
          } else {
            await browser.tabs.group({ groupId, tabIds: message.tabIds });
          }
          const group = await browser.tabGroups.update(groupId, {
            title: message.title,
            color: message.color || 'blue'
          });
          return { success: true, data: group };
        } catch (error) {
          return { success: false, error: `Tab group operation failed: ${error.message}` };
        }

      case 'ungroupTabs':
        if (!browser.tabGroups) {
          return { success: false, error: 'Tab Groups API not available' };
        }
        await Promise.all(
          message.tabIds.map(tabId => browser.tabs.ungroup(tabId))
        );
        return { success: true, data: null };

      case 'forwardToExtension':
        try {
          const resp = await browser.runtime.sendMessage(
            message.targetExtensionId,
            message.payload
          );
          return { success: true, data: resp };
        } catch (error) {
          return { success: false, error: `Extension not responding: ${error.message}` };
        }

      // --- New: Tab Lifecycle ---

      case 'createTab': {
        const createProps = { url: message.url || 'about:blank' };
        if (message.active !== undefined) createProps.active = message.active;
        if (message.windowId !== undefined) createProps.windowId = message.windowId;
        const newTab = await browser.tabs.create(createProps);
        return { success: true, data: newTab };
      }

      case 'closeTab':
        await browser.tabs.remove(message.tabId);
        return { success: true, data: null };

      case 'getTabById': {
        const tab = await browser.tabs.get(message.tabId);
        return { success: true, data: tab };
      }

      case 'updateTab': {
        const updateProps = {};
        if (message.url !== undefined) updateProps.url = message.url;
        if (message.active !== undefined) updateProps.active = message.active;
        if (message.muted !== undefined) updateProps.muted = message.muted;
        if (message.pinned !== undefined) updateProps.pinned = message.pinned;
        const updatedTab = await browser.tabs.update(message.tabId, updateProps);
        return { success: true, data: updatedTab };
      }

      // --- New: Tab Waiting ---

      case 'waitForTabUrl': {
        const pattern = message.pattern;
        const timeout = message.timeout || 10000;
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
          const allTabs = await browser.tabs.query({});
          const match = allTabs.find(t => t.url && t.url.includes(pattern));
          if (match) return { success: true, data: match };
          await new Promise(r => setTimeout(r, 250));
        }
        return { success: true, data: null };
      }

      // --- New: Execute in Tab ---

      case 'executeInTab': {
        const results = await browser.tabs.executeScript(message.tabId, {
          code: message.code
        });
        return { success: true, data: results ? results[0] : null };
      }

      // --- New: Screenshots ---

      case 'captureScreenshot': {
        const dataUrl = await browser.tabs.captureVisibleTab(null, {
          format: message.format || 'png'
        });
        return { success: true, data: dataUrl };
      }

      // --- New: Window Management ---

      case 'createWindow': {
        const winProps = { type: 'normal' };
        if (message.url) winProps.url = message.url;
        if (message.type) winProps.type = message.type;
        if (message.state) winProps.state = message.state;
        if (message.width !== undefined) winProps.width = message.width;
        if (message.height !== undefined) winProps.height = message.height;
        if (message.left !== undefined) winProps.left = message.left;
        if (message.top !== undefined) winProps.top = message.top;
        const newWindow = await browser.windows.create(winProps);
        return { success: true, data: newWindow };
      }

      case 'closeWindow':
        await browser.windows.remove(message.windowId);
        return { success: true, data: null };

      case 'getWindows': {
        const windows = await browser.windows.getAll({ populate: true });
        return { success: true, data: windows };
      }

      case 'getWindowById': {
        const win = await browser.windows.get(message.windowId, { populate: true });
        return { success: true, data: win };
      }

      case 'updateWindow': {
        const updateWinProps = {};
        if (message.state !== undefined) updateWinProps.state = message.state;
        if (message.width !== undefined) updateWinProps.width = message.width;
        if (message.height !== undefined) updateWinProps.height = message.height;
        if (message.left !== undefined) updateWinProps.left = message.left;
        if (message.top !== undefined) updateWinProps.top = message.top;
        if (message.focused !== undefined) updateWinProps.focused = message.focused;
        const updatedWindow = await browser.windows.update(message.windowId, updateWinProps);
        return { success: true, data: updatedWindow };
      }

      // --- New: Tab Events ---

      case 'getTabEvents': {
        const events = [...tabEventBuffer];
        if (message.clear) {
          tabEventBuffer.length = 0;
        }
        return { success: true, data: events };
      }

      // --- New: Window Events ---

      case 'getWindowEvents': {
        const winEvents = [...windowEventBuffer];
        if (message.clear) {
          windowEventBuffer.length = 0;
        }
        return { success: true, data: winEvents };
      }

      default:
        return { success: false, error: 'Unknown action: ' + message.action };
    }
  } catch (error) {
    console.error('[BRIDGE] Error handling message:', error);
    return { success: false, error: error.message };
  }
});

console.log('[BRIDGE] Ready to serve test requests');

} catch (error) {
  console.error('[BRIDGE] FATAL ERROR during initialization:', error);
  console.error('[BRIDGE] Stack:', error.stack);
}
