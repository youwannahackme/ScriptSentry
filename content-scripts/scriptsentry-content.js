// scriptsentry-content.js - Content script for ScriptSentry JS URL Monitor

(function() {
  const sentUrls = new Set();

  function filterJsUrls(entries) {
    const urls = [];
    entries.forEach(entry => {
      try {
        const url = entry.name;
        if (!url || sentUrls.has(url)) return;

        // Clean the URL to check the extension
        const cleanPath = url.split(/[?#]/)[0];
        
        // Match .js extension or if Chrome identifies it as a script initiator
        const isJs = cleanPath.match(/\.js$/i) || entry.initiatorType === 'script';
        
        if (isJs) {
          sentUrls.add(url);
          urls.push(url);
        }
      } catch (e) {
        console.error('[ScriptSentry] Error processing entry:', e);
      }
    });
    return urls;
  }

  function reportUrls(urls) {
    if (urls.length === 0) return;
    try {
      chrome.runtime.sendMessage({ action: 'addJsUrls', urls });
    } catch (err) {
      // If the extension context is invalidated (e.g. extension updated/reloaded),
      // we catch the error gracefully
      console.warn('[ScriptSentry] Failed to send URLs (context might be invalidated):', err);
    }
  }

  // 1. Process resources loaded prior to content script execution
  const initialEntries = performance.getEntriesByType('resource');
  const initialUrls = filterJsUrls(initialEntries);
  reportUrls(initialUrls);

  // 2. Observe resources loaded dynamically in the future
  try {
    const observer = new PerformanceObserver((list) => {
      const newUrls = filterJsUrls(list.getEntries());
      reportUrls(newUrls);
    });
    observer.observe({ entryTypes: ['resource'] });
  } catch (err) {
    console.error('[ScriptSentry] PerformanceObserver error:', err);
  }
})();
