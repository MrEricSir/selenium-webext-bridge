/**
 * Selenium WebExt Bridge API - Exposed to Selenium tests
 */

console.log('[BRIDGE API] Initializing...');

// Helper: send message to background and unwrap response
async function bgCall(msg) {
  const response = await browser.runtime.sendMessage(msg);
  if (!response.success) throw new Error(response.error);
  return response.data;
}

// Create the API that Selenium will call
window.TestBridge = {
  // --- Basics ---
  async ping() {
    return await bgCall({ action: 'ping' });
  },

  // --- Tab Queries ---
  async getTabs() {
    return await bgCall({ action: 'getTabs' });
  },
  async getTabById(tabId) {
    return await bgCall({ action: 'getTabById', tabId });
  },
  async getTabGroups() {
    return await bgCall({ action: 'getTabGroups' });
  },

  // --- Tab Lifecycle ---
  async createTab(url, active) {
    return await bgCall({ action: 'createTab', url, active });
  },
  async closeTab(tabId) {
    return await bgCall({ action: 'closeTab', tabId });
  },
  async updateTab(tabId, props) {
    return await bgCall({ action: 'updateTab', tabId, ...props });
  },

  // --- Tab State ---
  async moveTab(tabId, index) {
    return await bgCall({ action: 'moveTab', tabId, index });
  },
  async pinTab(tabId) {
    return await bgCall({ action: 'pinTab', tabId });
  },
  async unpinTab(tabId) {
    return await bgCall({ action: 'unpinTab', tabId });
  },
  async groupTabs(tabIds, title, color = 'blue', groupId = null) {
    return await bgCall({ action: 'groupTabs', tabIds, title, color, groupId });
  },
  async ungroupTabs(tabIds) {
    return await bgCall({ action: 'ungroupTabs', tabIds });
  },
  async muteTab(tabId) {
    return await bgCall({ action: 'muteTab', tabId });
  },
  async unmuteTab(tabId) {
    return await bgCall({ action: 'unmuteTab', tabId });
  },
  async reloadTab(tabId) {
    return await bgCall({ action: 'reloadTab', tabId });
  },
  async getActiveTab() {
    return await bgCall({ action: 'getActiveTab' });
  },

  // --- Tab Waiting ---
  async waitForTabUrl(pattern, timeout) {
    return await bgCall({ action: 'waitForTabUrl', pattern, timeout });
  },
  async waitFor(conditionFn, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await conditionFn()) return true;
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  },

  // --- Execute in Tab ---
  async executeInTab(tabId, code) {
    return await bgCall({ action: 'executeInTab', tabId, code });
  },

  // --- Screenshots ---
  async captureScreenshot(format) {
    return await bgCall({ action: 'captureScreenshot', format });
  },

  // --- Window Management ---
  async createWindow(url, options) {
    return await bgCall({ action: 'createWindow', url, ...options });
  },
  async closeWindow(windowId) {
    return await bgCall({ action: 'closeWindow', windowId });
  },
  async getWindows() {
    return await bgCall({ action: 'getWindows' });
  },
  async getWindowById(windowId) {
    return await bgCall({ action: 'getWindowById', windowId });
  },
  async updateWindow(windowId, props) {
    return await bgCall({ action: 'updateWindow', windowId, ...props });
  },

  // --- Tab Events ---
  async getTabEvents(clear) {
    return await bgCall({ action: 'getTabEvents', clear });
  },

  // --- Window Events ---
  async getWindowEvents(clear) {
    return await bgCall({ action: 'getWindowEvents', clear });
  },

  // --- Extension Forwarding ---
  async forwardToExtension(targetExtensionId, payload) {
    return await bgCall({ action: 'forwardToExtension', targetExtensionId, payload });
  }
};

// Update UI with available methods
document.addEventListener('DOMContentLoaded', async () => {
  const statusText = document.getElementById('status-text');
  const statusDiv = document.getElementById('status');
  const methodsDiv = document.getElementById('methods');

  try {
    const pong = await window.TestBridge.ping();
    statusText.textContent = `Ready! (${pong})`;
    statusDiv.classList.add('ready');

    const methods = Object.keys(window.TestBridge);
    methodsDiv.innerHTML = '<ul>' +
      methods.map(m => `<li><code>TestBridge.${m}()</code></li>`).join('') +
      '</ul>';

    console.log('[BRIDGE API] Ready!');
  } catch (error) {
    statusText.textContent = 'Error: ' + error.message;
    statusDiv.classList.add('error');
    console.error('[BRIDGE API] Error:', error);
  }
});
