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

  if (request.type === 'PREVIEW_PROFILE_FILL' || request.type === 'FILL_PROFILE') {
    const profile = request.profile || {};
    const controls = [...document.querySelectorAll('input:not([type="hidden"]):not([type="password"]), textarea, select')];
    const normalized = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const mappings = controls.map((control) => {
      const label = document.querySelector(`label[for="${control.id}"]`)?.innerText || '';
      const key = normalized(`${control.name} ${control.id} ${control.placeholder} ${label}`);
      const entry = Object.entries(profile).find(([profileKey]) => key.includes(normalized(profileKey)));
      return entry ? { selector: control.id ? `#${CSS.escape(control.id)}` : null, name: control.name, label: label || control.name || control.placeholder, value: entry[1] } : null;
    }).filter(Boolean);
    if (request.type === 'FILL_PROFILE') {
      mappings.forEach((mapping) => {
        const control = mapping.selector ? document.querySelector(mapping.selector) : controls.find((candidate) => candidate.name === mapping.name);
        if (!control) return;
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(control), 'value')?.set;
        setter?.call(control, mapping.value);
        control.dispatchEvent(new Event('input', { bubbles: true }));
        control.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    sendResponse({ mappings, filled: request.type === 'FILL_PROFILE' ? mappings.length : 0 });
  }
});
