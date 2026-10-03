// Background service worker: auth sync plus quick-save context-menu actions.

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
  const data = await chrome.storage.local.get(['holder_token', 'holder_server_url']);
  if (!data.holder_token) throw new Error('Sign in to Holder first');
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
  const uploadResponse = await fetch(`${apiBase}/items/upload-image?ocr=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
  const upload = await uploadResponse.json();
  if (!uploadResponse.ok || !upload.success) throw new Error(upload.message || 'Screenshot upload failed');
  await saveItem({
    title: `Screenshot — ${tab.title || new Date().toLocaleString()}`,
    type: 'image',
    url: tab.url || '',
    previewUrl: upload.imageUrl,
    ocrText: upload.ocrText || '',
    tags: ['screenshot', 'quick-clip'],
    metadata: { cloudinaryPublicId: upload.cloudinaryPublicId }
  });
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
