const API_BASE = 'http://localhost:5000/api';

document.addEventListener('DOMContentLoaded', async () => {
  const authSection = document.getElementById('authSection');
  const saveForm = document.getElementById('saveForm');
  const loginForm = document.getElementById('loginForm');
  const logoutBtn = document.getElementById('logoutBtn');
  const authStatus = document.getElementById('authStatus');

  const titleInput = document.getElementById('title');
  const urlInput = document.getElementById('url');
  const folderSelect = document.getElementById('folderId');
  const tagsInput = document.getElementById('tags');
  const notesInput = document.getElementById('notes');
  const statusDiv = document.getElementById('status');

  // Check saved token from chrome.storage.local
  chrome.storage.local.get(['holder_token'], async (result) => {
    const token = result.holder_token;

    if (token) {
      // Validate token
      try {
        const meRes = await fetch(`${API_BASE}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const meData = await meRes.json();
        if (meData.success) {
          showSaverForm(token);
        } else {
          showAuthSection();
        }
      } catch (err) {
        showSaverForm(token); // offline fallback
      }
    } else {
      showAuthSection();
    }
  });

  function showAuthSection() {
    authSection.classList.remove('hidden');
    saveForm.classList.add('hidden');
    logoutBtn.classList.add('hidden');
  }

  function showSaverForm(token) {
    authSection.classList.add('hidden');
    saveForm.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    loadFoldersAndTab(token);
  }

  // Handle Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authStatus.textContent = 'Logging in...';
    authStatus.className = 'status';

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.success && data.token) {
        chrome.storage.local.set({ holder_token: data.token });
        authStatus.textContent = '✅ Logged in successfully!';
        authStatus.className = 'status success';
        setTimeout(() => showSaverForm(data.token), 800);
      } else {
        throw new Error(data.message || 'Login failed');
      }
    } catch (err) {
      authStatus.textContent = `❌ ${err.message}`;
      authStatus.className = 'status error';
    }
  });

  // Handle Logout
  logoutBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['holder_token']);
    showAuthSection();
  });

  // Load Folders & Active Tab
  async function loadFoldersAndTab(token) {
    try {
      const res = await fetch(`${API_BASE}/folders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.folders) {
        folderSelect.innerHTML = '<option value="">📁 Uncategorized</option>';
        data.folders.forEach(folder => {
          const option = document.createElement('option');
          option.value = folder._id;
          option.textContent = `${folder.icon || '📁'} ${folder.name}`;
          folderSelect.appendChild(option);
        });
      }
    } catch (err) {
      console.warn('Holder Server not reachable for folder list:', err);
    }

    if (chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (tabs && tabs[0]) {
          const currentTab = tabs[0];
          urlInput.value = currentTab.url || '';
          titleInput.value = currentTab.title || '';

          if (currentTab.url && currentTab.url.includes('youtube.com')) {
            tagsInput.value = 'youtube, video';
            try {
              const metaRes = await fetch(`${API_BASE}/metadata/extract`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: currentTab.url })
              });
              const metaData = await metaRes.json();
              if (metaData.success && metaData.title) {
                titleInput.value = metaData.title;
              }
            } catch (e) {}
          }
        }
      });
    }
  }

  // Save Form Handler
  saveForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusDiv.textContent = 'Saving to Holder...';
    statusDiv.className = 'status';

    const url = urlInput.value;
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    const type = isYouTube ? 'youtube' : 'link';

    chrome.storage.local.get(['holder_token'], async (result) => {
      const token = result.holder_token;

      try {
        let previewUrl = '';
        let metadata = {};
        try {
          const metaRes = await fetch(`${API_BASE}/metadata/extract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });
          const metaData = await metaRes.json();
          if (metaData.success) {
            previewUrl = metaData.previewUrl || '';
            metadata = metaData.metadata || {};
          }
        } catch (err) {}

        const itemPayload = {
          title: titleInput.value,
          type: type,
          url: url,
          content: notesInput.value,
          folderId: folderSelect.value || null,
          previewUrl: previewUrl,
          metadata: metadata,
          tags: tagsInput.value.split(',').map(t => t.trim()).filter(Boolean)
        };

        const saveRes = await fetch(`${API_BASE}/items`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(itemPayload)
        });

        const saveData = await saveRes.json();
        if (saveData.success) {
          statusDiv.textContent = '✅ Saved to your personal vault!';
          statusDiv.className = 'status success';
          setTimeout(() => window.close(), 1500);
        } else {
          throw new Error(saveData.message || 'Failed to save');
        }
      } catch (err) {
        statusDiv.textContent = `❌ ${err.message}`;
        statusDiv.className = 'status error';
      }
    });
  });
});
