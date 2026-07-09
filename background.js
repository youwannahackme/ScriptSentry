// background.js - Service worker for ScriptSentry JS URL Monitor

// Helper to update the extension badge for a specific tab
function updateBadge(tabId, count) {
  const text = count > 0 ? String(count) : '';
  chrome.action.setBadgeText({ tabId, text });
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#8b5cf6' }); // Neon purple
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'addJsUrls' && sender.tab) {
    const tabId = sender.tab.id;
    const newUrls = message.urls || [];
    if (newUrls.length === 0) return;

    const storageKey = `tab_${tabId}`;
    chrome.storage.local.get(storageKey, (result) => {
      let tabData = result[storageKey] || {
        urls: [],
        title: sender.tab.title || '',
        url: sender.tab.url || ''
      };

      let updated = false;
      newUrls.forEach(url => {
        if (!tabData.urls.includes(url)) {
          tabData.urls.push(url);
          updated = true;
        }
      });

      if (updated) {
        chrome.storage.local.set({ [storageKey]: tabData }, () => {
          updateBadge(tabId, tabData.urls.length);
        });
      }
    });
  }
});

// Clear tab data on new page load navigation (e.g. reload or navigating to a new URL)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    const storageKey = `tab_${tabId}`;
    chrome.storage.local.remove(storageKey, () => {
      updateBadge(tabId, 0);
    });
  } else if (changeInfo.title || changeInfo.url) {
    const storageKey = `tab_${tabId}`;
    chrome.storage.local.get(storageKey, (result) => {
      let tabData = result[storageKey];
      if (tabData) {
        if (changeInfo.title) tabData.title = changeInfo.title;
        if (changeInfo.url) tabData.url = changeInfo.url;
        chrome.storage.local.set({ [storageKey]: tabData });
      }
    });
  }
});

// Clean up tab data when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  const storageKey = `tab_${tabId}`;
  chrome.storage.local.remove(storageKey);
});
