// popup.js - Controller for ScriptSentry JS URL Monitor popup

document.addEventListener('DOMContentLoaded', async () => {
  const tabBadge = document.getElementById('tab-badge');
  const activePage = document.getElementById('active-page');
  const activePageTitle = document.getElementById('active-page-title');
  const statTotal = document.getElementById('stat-total');
  const statDomains = document.getElementById('stat-domains');
  const searchInput = document.getElementById('search-input');
  const listSection = document.getElementById('list-section');
  
  const btnCopyAll = document.getElementById('btn-copy-all');
  const btnDownload = document.getElementById('btn-download');
  const btnClear = document.getElementById('btn-clear');
  const toast = document.getElementById('toast');

  let activeTab = null;
  let allUrls = [];

  // Helper to extract hostname from URL
  function getDomain(urlString) {
    try {
      return new URL(urlString).hostname;
    } catch (e) {
      return '';
    }
  }

  // Determine if script URL is first-party compared to tab URL
  function checkFirstParty(scriptUrl, tabUrl) {
    const scriptDomain = getDomain(scriptUrl);
    const tabDomain = getDomain(tabUrl);
    if (!scriptDomain || !tabDomain) return false;
    
    // Exact match or subdomains
    return scriptDomain === tabDomain || 
           scriptDomain.endsWith('.' + tabDomain) || 
           tabDomain.endsWith('.' + scriptDomain);
  }

  // Show a temporary toast message
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }

  // Copy text to clipboard
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  }

  // Load and render scripts
  async function loadTabData() {
    try {
      // Get the active tab in current window
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        tabBadge.textContent = 'No active tab';
        return;
      }
      activeTab = tab;

      // Update header with page info
      const tabDomain = getDomain(tab.url);
      tabBadge.textContent = tabDomain || 'Local Page';
      
      if (tab.title) {
        activePageTitle.textContent = tab.title;
        activePage.style.display = 'flex';
      }

      const storageKey = `tab_${tab.id}`;
      chrome.storage.local.get(storageKey, (result) => {
        const tabData = result[storageKey] || { urls: [] };
        allUrls = tabData.urls;
        renderList(allUrls);
      });
    } catch (error) {
      console.error('Error loading tab data:', error);
      tabBadge.textContent = 'Error';
    }
  }

  // Render the list of URL cards
  function renderList(urls) {
    listSection.innerHTML = '';
    
    if (urls.length === 0) {
      statTotal.textContent = '0';
      statDomains.textContent = '0';
      listSection.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🛡️</span>
          <p>No script requests monitored yet.</p>
        </div>
      `;
      return;
    }

    // Calculate unique domains
    const domains = new Set(urls.map(url => getDomain(url)).filter(d => d !== ''));
    statTotal.textContent = String(urls.length);
    statDomains.textContent = String(domains.size);

    const tabUrl = activeTab ? activeTab.url : '';

    urls.forEach(url => {
      const isFirst = checkFirstParty(url, tabUrl);
      const domainName = getDomain(url) || 'Unknown Domain';
      
      const card = document.createElement('div');
      card.className = 'url-card';
      card.dataset.url = url.toLowerCase();

      card.innerHTML = `
        <div class="url-card-header">
          <span class="party-tag ${isFirst ? 'first-party' : 'third-party'}">
            ${isFirst ? 'First Party' : 'Third Party'}
          </span>
          <div class="url-actions">
            <button class="icon-btn copy-btn" title="Copy URL">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button class="icon-btn open-btn" title="Open in New Tab">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </button>
          </div>
        </div>
        <div class="url-content">${escapeHtml(url)}</div>
      `;

      // Event listeners for individual card action buttons
      card.querySelector('.copy-btn').addEventListener('click', () => copyToClipboard(url));
      card.querySelector('.open-btn').addEventListener('click', () => {
        chrome.tabs.create({ url: url, active: false });
      });

      listSection.appendChild(card);
    });

    // Run filter to respect any query currently in the search input
    filterUrls(searchInput.value);
  }

  // HTML escape helper
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
  }

  // Real-time filtering logic
  function filterUrls(query) {
    const term = query.trim().toLowerCase();
    const cards = listSection.querySelectorAll('.url-card');
    let visibleCount = 0;

    cards.forEach(card => {
      const urlText = card.dataset.url;
      if (urlText.includes(term)) {
        card.style.display = 'flex';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    // Handle empty state for filtered view
    const existingFilteredEmpty = document.getElementById('filtered-empty-state');
    if (visibleCount === 0 && cards.length > 0) {
      if (!existingFilteredEmpty) {
        const empty = document.createElement('div');
        empty.id = 'filtered-empty-state';
        empty.className = 'empty-state';
        empty.innerHTML = `
          <span class="empty-icon">🔍</span>
          <p>No matching scripts found.</p>
        `;
        listSection.appendChild(empty);
      }
    } else if (existingFilteredEmpty) {
      existingFilteredEmpty.remove();
    }
  }

  // Search input keyup listener
  searchInput.addEventListener('input', (e) => {
    filterUrls(e.target.value);
  });

  // Action button: Copy All
  btnCopyAll.addEventListener('click', () => {
    if (allUrls.length === 0) {
      showToast('Nothing to copy');
      return;
    }
    copyToClipboard(allUrls.join('\n'));
  });

  // Action button: Download as TXT
  btnDownload.addEventListener('click', () => {
    if (allUrls.length === 0) {
      showToast('Nothing to download');
      return;
    }
    try {
      const blob = new Blob([allUrls.join('\n')], { type: 'text/plain;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      const domain = activeTab ? getDomain(activeTab.url).replace(/\./g, '_') : 'js_urls';
      
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `scriptsentry_${domain}_scripts.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      showToast('Downloaded text file!');
    } catch (err) {
      console.error('Download failed:', err);
      showToast('Download failed');
    }
  });

  // Action button: Clear current tab data
  btnClear.addEventListener('click', () => {
    if (!activeTab) return;
    if (allUrls.length === 0) {
      showToast('List is already empty');
      return;
    }
    const storageKey = `tab_${activeTab.id}`;
    chrome.storage.local.remove(storageKey, () => {
      allUrls = [];
      renderList(allUrls);
      
      // Update badge via background script action or direct (activeTab is scoped)
      chrome.action.setBadgeText({ tabId: activeTab.id, text: '' });
      showToast('Cleared tab data');
    });
  });

  // Load data immediately
  await loadTabData();
});
