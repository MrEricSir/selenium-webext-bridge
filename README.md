# selenium-webext-bridge

[![Tests](https://github.com/MrEricSir/selenium-webext-bridge/actions/workflows/test.yml/badge.svg)](https://github.com/MrEricSir/selenium-webext-bridge/actions/workflows/test.yml)
[![Coverage](https://codecov.io/gh/MrEricSir/selenium-webext-bridge/graph/badge.svg)](https://codecov.io/gh/MrEricSir/selenium-webext-bridge)

Build integration tests for your Firefox extensions with ease.

This test bridge runs alongside your Firefox extension, allowing Selenium tests written with Node to interact with browser tabs, windows, and communicate with your extension. All with a straightforward API.

## Install

```bash
npm install selenium-webext-bridge selenium-webdriver geckodriver
```

**Note:** You will need [Firefox](https://www.mozilla.org/firefox/) installed.


### Install From Source

```bash
git clone https://github.com/MrEricSir/selenium-webext-bridge.git
cd selenium-webext-bridge
npm install
npm install selenium-webdriver geckodriver
```

## Getting Started

```js
const { launchBrowser, cleanupBrowser, createTestServer } = require('selenium-webext-bridge');

// Start the test server to establish its communications channel.
const server = await createTestServer({ port: 8080 });

// Launch Firefox with the bridge and your extension installed.
const browser = await launchBrowser({
  extensions: ['/path/to/your/extension']
});
const bridge = browser.testBridge;

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
await cleanupBrowser(browser);
server.close();
```

### Going Deeper

The `launchBrowser()` and `cleanupBrowser()` functions are provided for convenience.

`launchBrowser()` creates a temporary Firefox profile, installs the bridge extension, initializes it, and then installs any local extensions you specify. Pass `headless: true` to run without a visible browser window (or set the `HEADLESS=1` environment variable.)

`cleanupBrowser()` quits the browser and removes the temporary profile.

If you need complete control over the browser configuration, you can set up Firefox manually instead. Note that you'll need to handle headless mode, profile management, and extension installs yourself if you go this route.

```js
const { Builder } = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
const { TestBridge, extensionDir, sleep } = require('selenium-webext-bridge');

const options = new firefox.Options();
options.addArguments('-headless');

const driver = await new Builder()
  .forBrowser('firefox')
  .setFirefoxOptions(options)
  .build();

await driver.installAddon(extensionDir, true);
await sleep(2000);

const bridge = new TestBridge(driver);
await bridge.init();

await driver.installAddon('/path/to/your/extension', true);
await sleep(2000);
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
| `reset()` | Resets the bridge by navigating to an HTTP page and re-initializing. Use after visiting extension or `about:` pages. |
| `captureScreenshot(format?)` | Screenshots the active tab (returns `data:image/png;...`) |
| `getExtensionUrl(extensionId)` | Returns the `moz-extension://` URL for an installed extension by its ID (the `id` field from the extension's `manifest.json`). |
| `getExtensionUrlByName(name)` | Returns the `moz-extension://` URL for an installed extension by its `name` field from `manifest.json`. Useful for extensions without a fixed ID. |
| `clickBrowserAction(extensionId)` | Clicks an extension's toolbar button. Requires `launchBrowser({ firefoxArgs: ['-remote-allow-system-access'] })`. |

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
| `closeOtherTabs()` | Closes all tabs except the focused one |
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
| `waitForTabLoad(tabId, timeout?)` | Waits for a tab to finish loading and returns the loaded tab, or `null` on timeout. |


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
| `launchBrowser(options?)` | Launches Firefox with the bridge extension installed. Options: `{ extensions, BridgeClass, headless, waitForInit, preferences, firefoxArgs }`. Returns `{ driver, testBridge, profilePath }` |
| `cleanupBrowser(browser)` | Quits the browser and removes its temporary profile |
| `extensionDir` | Path to the bridge extension directory (for manual setup with `driver.installAddon()`) |
| `sleep(ms)` | Promise-based delay |
| `waitForCondition(conditionFn, timeout?, interval?)` | Calls `conditionFn` until it returns a truthy value |
| `generateTestUrl(name?, port?)` | Generates `http://127.0.0.1:<port>/<name>-<timestamp>` URLs on the test bridge server |
| `createTestServer({ port?, host? })` | Starts the local test bridge server |
| `TabUtils` | Helper class for opening/closing/switching tabs via Selenium |
| `Assert` | Simple assertion utilities (`equal`, `greaterThan`, `includes`, `isTrue`, ...) |
| `TestResults` | Tracks test results with `pass()`, `fail()`, `error()`, `summary()` |
| `Command` | Makes the Command class from `selenium-webdriver` easily available |

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

Then pass it to `launchBrowser()` so it creates your subclass instead of the default:

```js
const browser = await launchBrowser({
  extensions: ['/path/to/your/extension'],
  BridgeClass: MyExtBridge
});
const bridge = browser.testBridge; // instanceof MyExtBridge
const state = await bridge.getState();
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
