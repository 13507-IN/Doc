const API_BASE = 'http://localhost:5000/api';

document.addEventListener('DOMContentLoaded', async () => {
  const titleInput = document.getElementById('title');
  const urlInput = document.getElementById('url');
  const folderSelect = document.getElementById('folderId');
  const tagsInput = document.getElementById('tags');
  const notesInput = document.getElementById('notes');
  const saveForm = document.getElementById('saveForm');
  const statusDiv = document.getElementById('status');

  // Load Folders from API
  try {
    const res = await fetch(`${API_BASE}/folders`);
    const data = await res.json();
    if (data.success && data.folders) {
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

  // Get Active Tab Info
  if (chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs && tabs[0]) {
        const currentTab = tabs[0];
        urlInput.value = currentTab.url || '';
        titleInput.value = currentTab.title || '';

        // Auto extract rich metadata if YouTube link
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

  // Save Form Handler
  saveForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusDiv.textContent = 'Saving to Holder...';
    statusDiv.className = 'status';

    const url = urlInput.value;
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    const type = isYouTube ? 'youtube' : 'link';

    try {
      // First extract preview metadata if possible
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemPayload)
      });

      const saveData = await saveRes.json();
      if (saveData.success) {
        statusDiv.textContent = '✅ Saved to Holder Vault!';
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
