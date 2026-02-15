# Changelog

## 0.1.0

Initial beta release.

### Features

- **TestBridge** class with full tab and window management via the bridge extension
- **Extension forwarding:** Sends messages to any installed extension via `sendToExtension()`
- **Extension discovery:** Gets `moz-extension://` URLs by ID (`getExtensionUrl`) or manifest name (`getExtensionUrlByName`)
- **Browser action:** Clicks an extension's toolbar button with `clickBrowserAction()`
- **Tab API:s** Create, close, update, reload, pin, mute, move, group/ungroup tabs
- **Tab waiters:** `waitForTabCount`, `waitForTabUrl`, `waitForTabEvent`, `waitForTabLoad`
- **Tab execution:** Runs JavaScript in any tab with `executeInTab()`
- **Tab and window events:** Event capture with `getTabEvents()` and `getWindowEvents()`
- **Window APIs:** Create, close, update, resize, and query windows
- **Screenshots:** Captures the active tab with `captureScreenshot()`
- **Context detection:** `ensureReady()` throws a clear error when on non-HTTP pages
- **Bridge recovery:** `reset()` re-establishes the bridge after visiting extension or about: pages
- **Helpers:** `launchBrowser`, `cleanupBrowser`, `createTestServer`, `sleep`, `waitForCondition`, `TestResults`, `Assert`, `TabUtils`
- **Subclassing support:** Pass a custom `BridgeClass` to `launchBrowser()` for extension-specific helpers
- **Command re-export:** `Command` from `selenium-webdriver` for chrome context switching
