// Background service worker: auth sync plus quick-save context-menu actions.
// A website sync is deliberately trusted for a bounded period so the popup can
// work without repeatedly requiring the Holder tab to be opened.
const AUTH_SYNC_DURATION_MS = 48 * 60 * 60 * 1000;
const AUTH_STORAGE_KEYS = ['holder_token', 'holder_user', 'holder_auth_synced_at', 'holder_auth_expires_at'];

function getAuthExpiry(token) {
  const syncedAt = Date.now();
  let expiresAt = syncedAt + AUTH_SYNC_DURATION_MS;

  // Never keep a JWT beyond its own expiry when it contains one.
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (Number.isFinite(payload.exp)) expiresAt = Math.min(expiresAt, payload.exp * 1000);
  } catch {
    // Tokens do not have to be JWTs; the 48-hour sync window still applies.
  }

  return { syncedAt, expiresAt };
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'holder-save-selection',
    title: 'Save selection to Holder',
    contexts: ['selection']
  });
  chrome.contextMenus.create({
    id: 'holder-save-screenshot',
    title: 'Capture screenshot to Holder',
    contexts: ['page', 'image', 'video']
  });
});

async function getSession() {
  const data = await chrome.storage.local.get(['holder_token', 'holder_server_url', 'holder_auth_expires_at']);
  if (!data.holder_token) throw new Error('Sign in to Holder first');
  if (!data.holder_auth_expires_at) {
    // Migration for existing users: start their bounded 48-hour window the
    // first time this upgraded extension uses their already-saved token.
    const { syncedAt, expiresAt } = getAuthExpiry(data.holder_token);
    await chrome.storage.local.set({
      holder_auth_synced_at: syncedAt,
      holder_auth_expires_at: expiresAt
    });
    data.holder_auth_expires_at = expiresAt;
  }
  if (Date.now() >= data.holder_auth_expires_at) {
    await chrome.storage.local.remove(AUTH_STORAGE_KEYS);
    throw new Error('Your Holder sync expired. Open the Holder website to sync again.');
  }
  return {
    token: data.holder_token,
    apiBase: (data.holder_server_url || 'http://localhost:5000/api').replace(/\/$/, '')
  };
}

async function saveItem(item) {
  const { token, apiBase } = await getSession();
  const response = await fetch(`${apiBase}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(item)
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || 'Could not save item');
  return data;
}

function showResult(text, color = '#16a34a') {
  chrome.action.setBadgeBackgroundColor({ color });
  chrome.action.setBadgeText({ text });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2500);
}

async function saveSelection(info, tab) {
  const selectedText = (info.selectionText || '').trim();
  if (!selectedText) throw new Error('Select text on the page first');
  await saveItem({
    title: selectedText.slice(0, 80),
    type: 'note',
    url: tab?.url || info.pageUrl || '',
    content: selectedText,
    tags: ['quick-clip', 'selection'],
    metadata: { sourceUrl: tab?.url || info.pageUrl || '', capturedAt: new Date().toISOString() }
  });
  showResult('✓');
}

async function saveScreenshot(tab) {
  const { token, apiBase } = await getSession();
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  const blob = await (await fetch(dataUrl)).blob();
  const formData = new FormData();
  formData.append('image', blob, `screenshot-${Date.now()}.png`);
  formData.append('title', `Screenshot — ${tab.title || new Date().toLocaleString()}`);
  formData.append('url', tab.url || '');
  const uploadResponse = await fetch(`${apiBase}/items/screenshot`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
  const screenshot = await uploadResponse.json();
  if (!uploadResponse.ok || !screenshot.success) throw new Error(screenshot.message || 'Screenshot upload failed');
  if (screenshot.storage === 'local') {
    console.error('[Holder] Cloudinary is unavailable; screenshot was saved to server-local storage.', screenshot.storageWarning);
  }
  showResult('✓');
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === 'holder-save-selection') await saveSelection(info, tab);
    if (info.menuItemId === 'holder-save-screenshot') await saveScreenshot(tab);
  } catch (error) {
    console.error('Holder quick save failed:', error);
    showResult('!', '#dc2626');
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'save-selection') return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const clip = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SMART_CLIP' });
    await saveSelection({ selectionText: clip.selectedText, pageUrl: tab.url }, tab);
  } catch (error) {
    console.error('Holder keyboard quick save failed:', error);
    showResult('!', '#dc2626');
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SYNC_HOLDER_AUTH') {
    const { syncedAt, expiresAt } = getAuthExpiry(message.token);
    chrome.storage.local.set({
      holder_token: message.token,
      holder_user: message.user,
      holder_auth_synced_at: syncedAt,
      holder_auth_expires_at: expiresAt
    }, () => {
      console.log('✅ Holder Extension synced auth from web app for up to 48 hours');
      sendResponse({ success: true, expiresAt });
    });
    return true;
  }

  if (message.type === 'CLEAR_HOLDER_AUTH') {
    chrome.storage.local.remove(AUTH_STORAGE_KEYS, () => {
      console.log('🔒 Holder Extension cleared token');
      sendResponse({ success: true });
    });
    return true;
  }
});
