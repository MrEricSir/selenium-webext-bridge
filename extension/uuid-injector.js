/**
 * UUID Injector Content Script
 *
 * Injects the test bridge extension UUID into every page so Selenium can find it
 */

(function() {
    // Get our own extension UUID
    const extensionURL = browser.runtime.getURL('test-api.html');
    const uuidMatch = extensionURL.match(/moz-extension:\/\/([^\/]+)/);

    if (!uuidMatch) {
        console.error('[BRIDGE] Failed to extract UUID from:', extensionURL);
        return;
    }

    const uuid = uuidMatch[1];

    // CRITICAL: Content scripts run in an isolated world
    // We need to inject into the page's actual context, not the content script context
    // We do this by injecting a <script> tag that runs in the page context

    function injectIntoPageContext() {
        const script = document.createElement('script');
        script.textContent = `
            window.__TEST_BRIDGE_UUID = ${JSON.stringify(uuid)};
            window.__TEST_BRIDGE_URL = ${JSON.stringify(extensionURL)};
            console.log('[BRIDGE] UUID injected into page context:', ${JSON.stringify(uuid)});
        `;

        // Inject at the very beginning of document
        if (document.documentElement) {
            document.documentElement.appendChild(script);
            script.remove(); // Clean up after injection
        } else {
            // If documentElement doesn't exist yet, wait
            setTimeout(injectIntoPageContext, 10);
        }
    }

    // Also create a meta tag marker
    function injectMarker() {
        if (document.head) {
            const marker = document.createElement('meta');
            marker.name = 'test-bridge-uuid';
            marker.content = uuid;
            document.head.appendChild(marker);
        } else {
            setTimeout(injectMarker, 10);
        }
    }

    // Inject immediately
    injectIntoPageContext();
    injectMarker();
})();
