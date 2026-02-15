/**
 * Hello World Extension - Background Script
 *
 * Demonstrates the pattern for making your extension testable
 * with selenium-webext-bridge. Just listen on onMessageExternal
 * and return { success, data } responses.
 */

let counter = 0;

browser.runtime.onMessageExternal.addListener(async (message, sender) => {
  try {
    switch (message.action) {
      case 'ping':
        return { success: true, data: 'hello world' };

      case 'greet':
        return { success: true, data: `Hello, ${message.name || 'stranger'}!` };

      case 'getCounter':
        return { success: true, data: counter };

      case 'increment':
        counter++;
        return { success: true, data: counter };

      default:
        return { success: false, error: `Unknown action: ${message.action}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Increment counter when the browser action button is clicked.
browser.browserAction.onClicked.addListener(() => {
  counter++;
  console.log(`[Hello World] Action clicked, counter: ${counter}`);
});

console.log('[Hello World] Extension loaded');
