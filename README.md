# selenium-webext-bridge

[![Tests](https://github.com/MrEricSir/selenium-webext-bridge/actions/workflows/test.yml/badge.svg)](https://github.com/MrEricSir/selenium-webext-bridge/actions/workflows/test.yml)
[![Coverage](https://codecov.io/gh/MrEricSir/selenium-webext-bridge/graph/badge.svg)](https://codecov.io/gh/MrEricSir/selenium-webext-bridge)

Build integration tests for your Firefox extensions with ease.

This test bridge runs alongside your Firefox extension, allowing Selenium tests written with Node to interact with browser tabs, windows, and communicate with your extension. All with a straightforward API.

## Install

```bash
# Install requirements.
npm install selenium-webdriver geckodriver

# Install this extension.
npm install selenium-webext-bridge
```

## Getting Started

```js
const { Builder } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
const { TestBridge, extensionDir, sleep, createTestServer } = require('selenium-webext-bridge');

// Start the test server to establish its communications channel.
const server = await createTestServer({ port: 8080 });

// Launch Firefox and install the bridge.
const driver = await new Builder().forBrowser('firefox').build();
await driver.installAddon(extensionDir, true);
await sleep(2000);

// Initialize the bridge. This will navigate to a page on the test server to establish communications.
const bridge = new TestBridge(driver);
await bridge.init();

// Install your extension.
await driver.installAddon('/path/to/your/extension', true);
await sleep(2000); // Waits for Firefox to process the installation.

// Communicate with your extension.
const response = await bridge.sendToExtension('your-ext@id', {
  action: 'getState'
});
console.log(response);  // Message sent back from your extension.

// Try the bridge APIs.
const tabs = await bridge.getTabs();
const tab = await bridge.createTab('https://example.com');
const title = await bridge.executeInTab(tab.id, 'document.title');
const screenshot = await bridge.captureScreenshot();

// Leave everything in a clean state. This would most likely live in a finally {} block.
await driver.quit();
server.close();
```

## Designing Your Extension For Testability

Firefox extensions talk to each other using a messaging API. The bridge uses this to communicate with your extension during tests.

**Step 1:** Add a listener in your extension's background script to receive messages:

```js
// your-extension/background.js
browser.runtime.onMessageExternal.addListener(async (message, sender) => {
  switch (message.action) {
    case 'getData':
      // Return whatever data your tests need to check.
      return { success: true, data: { count: 42 } };
    case 'doThing':
      // Or perform an action based on the message.
      doThing();
      return { success: true };
    default:
      // Implement some kind of sanity check to handle unknown messages.
      return { success: false, error: 'Unknown action' };
  }
});
```

**Step 2:** In your Selenium tests, use `sendToExtension()` to send messages to your listener via the bridge API.

```js
// In your tests:
const response = await bridge.sendToExtension('your-ext@id', {
  action: 'getData'
});
console.log(response); // { success: true, data: { count: 42 } }
```

It's up to you what to implement in your listener. Some possibilities include returning internal state, resetting variables between tests, and interacting with the UI.

**Note:** It's somewhat common for extensions to filter out unexpected `sender.id` values. In your extension the `sender.id` of messages sent this way will be the bridge's extension ID: `selenium-webext-bridge@test.local`.

## API

### TestBridge

#### Core
| Method | Description |
|:-------|:------------|
| `new TestBridge(driver)` | Creates a test bridge instance |
| `init()` | Navigates to a page and waits for the bridge content script to inject |
| `ping()` | Verifies the bridge is working (returns `"pong"`) |
| `captureScreenshot(format?)` | Screenshots the active tab (returns `data:image/png;...`) |

#### Extension Forwarding
| Method | Description |
|:-------|:------------|
| `sendToExtension(extensionId, payload)` | Forwards a message to any installed extension |

#### Tab Queries
| Method | Description |
|:-------|:------------|
| `getTabs()` | Gets all browser tabs |
| `getTabById(tabId)` | Gets a single tab's full state |
| `getActiveTab()` | Gets the currently active tab in the current window |
| `getTabGroups()` | Gets all tab groups (empty array if not supported) |

#### Tab Lifecycle
| Method | Description |
|:-------|:------------|
| `createTab(url, active?)` | Opens a new tab (without switching Selenium focus) |
| `closeTab(tabId)` | Closes a tab by ID |
| `updateTab(tabId, { url?, active?, muted?, pinned? })` | Updates properties of a tab |
| `reloadTab(tabId)` | Reloads a tab |

#### Tab State
| Method | Description |
|:-------|:------------|
| `moveTab(tabId, index)` | Moves a tab to a new position |
| `pinTab(tabId)` / `unpinTab(tabId)` | Pins or unpins a tab |
| `muteTab(tabId)` / `unmuteTab(tabId)` | Mutes or unmutes a tab |
| `groupTabs(tabIds, title, color?, groupId?)` | Groups tabs into a new or existing tab group |
| `ungroupTabs(tabIds)` | Ungroups tabs |

#### Tab Execution and Events
| Method | Description |
|:-------|:------------|
| `executeInTab(tabId, code)` | Runs JavaScript in a specific tab and returns the result |
| `getTabEvents(clear?)` | Gets buffered tab created/updated/removed events (last 100). Pass `true` to clear. |

#### Tab Waiters
| Method | Description |
|:-------|:------------|
| `waitForTabCount(n, timeout?)` | Waits until the browser has exactly `n` tabs |
| `waitForTabUrl(pattern, timeout?)` | Waits for any tab URL to contain `pattern` (returns the tab, or `null` on timeout) |
| `waitForTabEvent(eventType, timeout?)` | Waits for a specific tab event type (e.g. `'created'`, `'removed'`). Returns the event, or `null` on timeout. |


#### Window Management
| Method | Description |
|:-------|:------------|
| `getWindows()` | Lists all windows with their tabs |
| `createWindow(url?, options?)` | Opens a new browser window. Options: `{ type, state, width, height, left, top }` |
| `closeWindow(windowId)` | Closes a window |
| `getWindowById(windowId)` | Gets a single window's state with its tabs |
| `updateWindow(windowId, props)` | Updates window properties (`{ state, width, height, left, top, focused }`) |

#### Window Misc.
| Method | Description |
|:-------|:------------|
| `getWindowEvents(clear?)` | Gets buffered window created/removed events (last 100). Pass `true` to clear. |
| `waitForWindowCount(n, timeout?)` | Waits until the browser has exactly `n` windows |

### Helpers

| Export | Description |
|:-------|:------------|
| `extensionDir` | Path to the bridge extension directory. Pass this to `driver.installAddon()` |
| `sleep(ms)` | Promise-based delay |
| `waitForCondition(conditionFn, timeout?, interval?)` | Calls `conditionFn` until it returns a truthy value |
| `generateTestUrl(name?, port?)` | Generates `http://127.0.0.1:<port>/<name>-<timestamp>` URLs on the test bridge server |
| `createTestServer({ port?, host? })` | Starts the local test bridge server |
| `TabUtils` | Helper class for opening/closing/switching tabs via Selenium |
| `Assert` | Simple assertion utilities (`equal`, `greaterThan`, `includes`, `isTrue`, ...) |
| `TestResults` | Tracks test results with `pass()`, `fail()`, `error()`, `summary()` |

### Creating a TestBridge Subclass

Need custom functionality for your own extension? Add it with a `TestBridge` subclass:

```js
const { TestBridge } = require('selenium-webext-bridge');

class MyExtBridge extends TestBridge {
  constructor(driver) {
    super(driver);
    this.extId = 'my-ext@example.com';
  }

  async getState() {
    const resp = await this.sendToExtension(this.extId, { action: 'getState' });
    if (!resp.success) throw new Error(resp.error);
    return resp.data;
  }
}
```

## Examples

See [`examples/hello-world/`](examples/hello-world/) for a complete minimal example of a Firefox extension with a Selenium integration test.

```bash
cd examples/hello-world
node test.js
```

There is a full test suite in [`tests/bridge-api.test.js`](tests/bridge-api.test.js) that makes use of every method. This can provide helpful examples for your own extension tests.

## Under The Hood

The test bridge extension works around some limitations in Firefox with a bit of trickery. Here's how:

1. A **content script** injects `window.TestBridge` into every webpage.
2. Selenium calls `window.TestBridge` methods via `driver.executeScript()`
3. The content script relays requests to the bridge's **background script.**
4. The background script either handles browser API calls directly (getTabs, createTab, executeInTab, etc.) or forwards messages to your extension via `browser.runtime.sendMessage(targetId, payload)`
