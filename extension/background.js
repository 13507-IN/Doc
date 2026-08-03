// Background service worker to save synced auth token in chrome.storage.local

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SYNC_HOLDER_AUTH') {
    chrome.storage.local.set({ 
      holder_token: message.token,
      holder_user: message.user
    }, () => {
      console.log('✅ Holder Extension synced token from web app');
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'CLEAR_HOLDER_AUTH') {
    chrome.storage.local.remove(['holder_token', 'holder_user'], () => {
      console.log('🔒 Holder Extension cleared token');
      sendResponse({ success: true });
    });
    return true;
  }
});
