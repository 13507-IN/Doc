// Content script running on the Holder Web App page to sync authentication token with Chrome Extension

function syncTokenToExtension() {
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
}

// Initial sync on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', syncTokenToExtension);
} else {
  syncTokenToExtension();
}

// Listen for window postMessage from Web App (login/logout/Google OAuth)
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'HOLDER_AUTH_TOKEN') {
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
  if (event.key === 'holder_token' || event.key === 'holder_user') {
    syncTokenToExtension();
  }
});

// Respond to direct requests from popup script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'REQUEST_HOLDER_AUTH_SYNC') {
    syncTokenToExtension();
    sendResponse({ success: true, token: localStorage.getItem('holder_token') });
  }
});
