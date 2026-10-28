// Content script running on the Holder Web App page to sync authentication token with Chrome Extension

function isHolderWebsite() {
  return (
    (location.hostname === 'localhost' && location.port === '3000') ||
    location.hostname.endsWith('.vercel.app')
  );
}

function syncTokenToExtension() {
  // This script also powers clipping on ordinary websites. Only the Holder web
  // app is allowed to alter extension authentication; otherwise navigating to
  // any page without Holder localStorage would silently clear a valid sync.
  if (!isHolderWebsite()) return false;

  try {
    const token = localStorage.getItem('holder_token');
    const userStr = localStorage.getItem('holder_user');

    // Tag body so web app knows extension is installed
    if (document.body) {
      document.body.setAttribute('data-holder-extension-installed', 'true');
    }

    if (token) {
      chrome.runtime.sendMessage({
        type: 'SYNC_HOLDER_AUTH',
        token: token,
        user: userStr ? JSON.parse(userStr) : null
      }, (response) => {
        if (chrome.runtime.lastError) {
          // Extension listener standard fallback
        }
      });
    } else {
      chrome.runtime.sendMessage({
        type: 'CLEAR_HOLDER_AUTH'
      });
    }
  } catch (err) {
    console.error('Holder Extension Sync Error:', err);
  }
  return true;
}

// Initial sync on page load
if (isHolderWebsite() && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', syncTokenToExtension);
} else if (isHolderWebsite()) {
  syncTokenToExtension();
}

// Listen for window postMessage from Web App (login/logout/Google OAuth)
window.addEventListener('message', (event) => {
  if (isHolderWebsite() && event.data && event.data.type === 'HOLDER_AUTH_TOKEN') {
    if (event.data.token) {
      chrome.runtime.sendMessage({
        type: 'SYNC_HOLDER_AUTH',
        token: event.data.token,
        user: event.data.user
      });
    } else {
      chrome.runtime.sendMessage({
        type: 'CLEAR_HOLDER_AUTH'
      });
    }
  }
});

// Listen for cross-tab localStorage changes
window.addEventListener('storage', (event) => {
  if (isHolderWebsite() && (event.key === 'holder_token' || event.key === 'holder_user')) {
    syncTokenToExtension();
  }
});

// Respond to direct requests from popup script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'REQUEST_HOLDER_AUTH_SYNC') {
    const synced = syncTokenToExtension();
    sendResponse({
      success: synced,
      token: synced ? localStorage.getItem('holder_token') : null
    });
  }

  if (request.type === 'GET_SMART_CLIP') {
    const description = document.querySelector('meta[name="description"], meta[property="og:description"]')?.content || '';
    const keywords = document.querySelector('meta[name="keywords"]')?.content || '';
    sendResponse({
      title: document.title,
      description,
      keywords: keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean),
      selectedText: window.getSelection()?.toString().trim().slice(0, 2000) || ''
    });
  }
});
