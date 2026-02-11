/**
 * Direct Bridge - Content script that relays messages between page and background
 */

console.log('[DIRECT BRIDGE] Initializing...');

// Inject TestBridge API into page
const script = document.createElement('script');
script.textContent = `
(function() {
  console.log('[DIRECT BRIDGE] Creating API in page context...');

  let requestId = 0;
  const pendingRequests = new Map();

  // Listen for responses from content script via postMessage
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'bridge-response') {
      const { id, response, error } = event.data;
      const { resolve, reject } = pendingRequests.get(id) || {};
      if (resolve) {
        pendingRequests.delete(id);
        if (error) reject(new Error(error));
        else resolve(response);
      }
    }
  });

  // Send request to content script via postMessage
  function sendRequest(action, data) {
    return new Promise((resolve, reject) => {
      const id = ++requestId;
      pendingRequests.set(id, { resolve, reject });
      window.postMessage({ type: 'bridge-request', id, action, data }, '*');
      // Timeout after 15 seconds (some ops like waitForTabUrl can take a while)
      setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error('Request timed out'));
        }
      }, 15000);
    });
  }

  window.TestBridge = {
    // --- Basics ---
    async ping() {
      return await sendRequest('ping');
    },

    // --- Tab Queries ---
    async getTabs() {
      return await sendRequest('getTabs');
    },
    async getTabById(tabId) {
      return await sendRequest('getTabById', { tabId });
    },
    async getTabGroups() {
      return await sendRequest('getTabGroups');
    },

    // --- Tab Lifecycle ---
    async createTab(url, active) {
      return await sendRequest('createTab', { url, active });
    },
    async closeTab(tabId) {
      return await sendRequest('closeTab', { tabId });
    },
    async updateTab(tabId, props) {
      return await sendRequest('updateTab', { tabId, ...props });
    },

    // --- Tab State ---
    async moveTab(tabId, index) {
      return await sendRequest('moveTab', { tabId, index });
    },
    async pinTab(tabId) {
      return await sendRequest('pinTab', { tabId });
    },
    async unpinTab(tabId) {
      return await sendRequest('unpinTab', { tabId });
    },
    async groupTabs(tabIds, title, color, groupId) {
      return await sendRequest('groupTabs', { tabIds, title, color: color || 'blue', groupId });
    },
    async ungroupTabs(tabIds) {
      return await sendRequest('ungroupTabs', { tabIds });
    },
    async muteTab(tabId) {
      return await sendRequest('muteTab', { tabId });
    },
    async unmuteTab(tabId) {
      return await sendRequest('unmuteTab', { tabId });
    },
    async reloadTab(tabId) {
      return await sendRequest('reloadTab', { tabId });
    },
    async getActiveTab() {
      return await sendRequest('getActiveTab');
    },

    // --- Tab Waiting ---
    async waitForTabUrl(pattern, timeout) {
      return await sendRequest('waitForTabUrl', { pattern, timeout });
    },
    async waitFor(conditionFn, timeout) {
      timeout = timeout || 5000;
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (await conditionFn()) return true;
        await new Promise(r => setTimeout(r, 100));
      }
      return false;
    },

    // --- Execute in Tab ---
    async executeInTab(tabId, code) {
      return await sendRequest('executeInTab', { tabId, code });
    },

    // --- Screenshots ---
    async captureScreenshot(format) {
      return await sendRequest('captureScreenshot', { format });
    },

    // --- Window Management ---
    async createWindow(url, options) {
      return await sendRequest('createWindow', { url, ...options });
    },
    async closeWindow(windowId) {
      return await sendRequest('closeWindow', { windowId });
    },
    async getWindows() {
      return await sendRequest('getWindows');
    },
    async getWindowById(windowId) {
      return await sendRequest('getWindowById', { windowId });
    },
    async updateWindow(windowId, props) {
      return await sendRequest('updateWindow', { windowId, ...props });
    },

    // --- Tab Events ---
    async getTabEvents(clear) {
      return await sendRequest('getTabEvents', { clear });
    },

    // --- Window Events ---
    async getWindowEvents(clear) {
      return await sendRequest('getWindowEvents', { clear });
    },

    // --- Extension Forwarding ---
    async forwardToExtension(targetExtensionId, payload) {
      return await sendRequest('forwardToExtension', { targetExtensionId, payload });
    }
  };

  console.log('[DIRECT BRIDGE] API ready');
})();
`;
document.documentElement.appendChild(script);
script.remove();

// All actions that route through the background script
const BG_ACTIONS = new Set([
  'getTabs', 'getTabGroups', 'moveTab', 'pinTab', 'unpinTab',
  'muteTab', 'unmuteTab', 'reloadTab', 'getActiveTab',
  'groupTabs', 'ungroupTabs', 'forwardToExtension',
  'createTab', 'closeTab', 'getTabById', 'updateTab',
  'waitForTabUrl', 'executeInTab', 'captureScreenshot',
  'createWindow', 'closeWindow', 'getWindows', 'getWindowById',
  'updateWindow', 'getTabEvents', 'getWindowEvents'
]);

// Listen for requests from page via postMessage
window.addEventListener('message', async (event) => {
  // Only accept messages from same window
  if (event.source !== window) return;
  if (!event.data || event.data.type !== 'bridge-request') return;

  const { id, action, data } = event.data;

  try {
    let response;

    if (action === 'ping') {
      response = 'pong';
    } else if (BG_ACTIONS.has(action)) {
      // Route through background script
      const bgResponse = await browser.runtime.sendMessage({ action, ...data });
      if (bgResponse && bgResponse.success) {
        response = bgResponse.data;
      } else if (bgResponse && bgResponse.error) {
        throw new Error(bgResponse.error);
      } else {
        response = bgResponse;
      }
    } else {
      throw new Error('Unknown action: ' + action);
    }

    window.postMessage({ type: 'bridge-response', id, response }, '*');
  } catch (error) {
    console.error('[DIRECT BRIDGE] Error:', error);
    window.postMessage({ type: 'bridge-response', id, error: error.message }, '*');
  }
});

console.log('[DIRECT BRIDGE] Ready');
