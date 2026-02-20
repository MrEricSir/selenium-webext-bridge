let clickCount = 0;

// Show the page action when the content script reports an HTTP page.
browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message.action === 'showPageAction' && sender.tab) {
    browser.pageAction.show(sender.tab.id);
  }
});

// Track clicks on the page action.
browser.pageAction.onClicked.addListener(() => {
  clickCount++;
  console.log(`[PageActionTest] Clicked, count: ${clickCount}`);
});

// Respond to external messages for test verification.
browser.runtime.onMessageExternal.addListener(async (message) => {
  switch (message.action) {
    case 'getClickCount':
      return { success: true, data: clickCount };
    default:
      return { success: false, error: `Unknown action: ${message.action}` };
  }
});

console.log('[PageActionTest] Extension loaded');
