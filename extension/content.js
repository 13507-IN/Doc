// Content script running on the Holder Web App page to sync authentication token with Chrome Extension

function syncTokenToExtension() {
  try {
    const token = localStorage.getItem('holder_token');
    const userStr = localStorage.getItem('holder_user');

    if (token) {
      chrome.runtime.sendMessage({
        type: 'SYNC_HOLDER_AUTH',
        token: token,
        user: userStr ? JSON.parse(userStr) : null
      }, (response) => {
        if (chrome.runtime.lastError) {
          // Extension popup context not active or listener busy
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
syncTokenToExtension();

// Listen for window postMessage from Web App
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
