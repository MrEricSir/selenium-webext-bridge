// Tell the background script to show the page action for this tab.
browser.runtime.sendMessage({ action: 'showPageAction' });
