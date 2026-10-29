'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { Sparkles, Check, ArrowRight, Folder, Tv, Link as LinkIcon, FileText, AlertCircle, Image as ImageIcon } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

async function getSharedPayloadFromDB() {
  if (typeof window === 'undefined' || !window.indexedDB) return null;
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('holder_share_db', 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('shared_items')) {
          db.createObjectStore('shared_items', { keyPath: 'id' });
        }
      };
      request.onsuccess = (e) => {
        const db = e.target.result;
        try {
          const tx = db.transaction('shared_items', 'readwrite');
          const store = tx.objectStore('shared_items');
          const getReq = store.get('latest');
          getReq.onsuccess = () => {
            const data = getReq.result;
            if (data) {
              store.delete('latest');
            }
            tx.oncomplete = () => {
              db.close();
              resolve(data || null);
            };
          };
          getReq.onerror = () => {
            db.close();
            resolve(null);
          };
        } catch (err) {
          db.close();
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

function ShareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [token, setToken] = useState(null);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [type, setType] = useState('link'); // 'link' | 'youtube' | 'image' | 'pdf' | 'note'
  const [previewUrl, setPreviewUrl] = useState('');
  const [metadata, setMetadata] = useState({});
  const [tags, setTags] = useState('mobile');
  const [sharedFile, setSharedFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState('');

  // Extract shared content from IndexedDB (files/images) or query params (links/text)
  useEffect(() => {
    let objectUrlToRevoke = null;

    async function initShare() {
      // 1. First check IndexedDB for shared media from Web Share Target Level 2
      const dbPayload = await getSharedPayloadFromDB();

      let extractedTitle = searchParams.get('title') || '';
      let extractedText = searchParams.get('text') || '';
      let extractedUrl = searchParams.get('url') || '';
      let detectedType = 'link';

      if (dbPayload) {
        if (dbPayload.title) extractedTitle = dbPayload.title;
        if (dbPayload.text) extractedText = dbPayload.text;
        if (dbPayload.url) extractedUrl = dbPayload.url;

        if (dbPayload.file && dbPayload.file.blob) {
          setSharedFile(dbPayload.file);
          objectUrlToRevoke = URL.createObjectURL(dbPayload.file.blob);
          setPreviewUrl(objectUrlToRevoke);

          const mime = (dbPayload.file.type || '').toLowerCase();
          if (mime.includes('pdf')) {
            detectedType = 'pdf';
            setTags('mobile, pdf');
          } else {
            detectedType = 'image';
            setTags('mobile, screenshot, image');
          }

          if (!extractedTitle) {
            extractedTitle = dbPayload.file.name
              ? dbPayload.file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim()
              : 'Shared Screenshot';
          }
        }
      }

      // If no file was shared, extract from URL/text
      if (!dbPayload?.file) {
        const urlRegex = /(https?:\/\/[^\s]+)/i;
        let remainingNotes = extractedText;

        if (!extractedUrl && extractedText) {
          const match = extractedText.match(urlRegex);
          if (match) {
            extractedUrl = match[0];
            remainingNotes = extractedText.replace(extractedUrl, '').trim();
          }
        }

        const isYouTube = extractedUrl.includes('youtube.com') || extractedUrl.includes('youtu.be');
        detectedType = extractedUrl ? (isYouTube ? 'youtube' : 'link') : 'note';

        extractedText = remainingNotes;
        if (!extractedTitle) {
          extractedTitle = isYouTube ? 'Shared YouTube Video' : (extractedUrl ? 'Shared Link' : 'Shared Note');
        }
        setTags(isYouTube ? 'mobile, youtube' : 'mobile');

        // Fetch rich metadata if it's a URL
        if (extractedUrl) {
          axios.post(`${API_BASE}/metadata/extract`, { url: extractedUrl })
            .then(res => {
              if (res.data.success) {
                if (res.data.title && !searchParams.get('title')) setTitle(res.data.title);
                if (res.data.previewUrl) setPreviewUrl(res.data.previewUrl);
                if (res.data.metadata) setMetadata(res.data.metadata);
              }
            })
            .catch(() => {});
        }
      }

      setUrl(extractedUrl);
      setType(detectedType);
      setTitle(extractedTitle);
      setNotes(extractedText);

      // Load auth token
      const savedToken = typeof window !== 'undefined' ? localStorage.getItem('holder_token') : null;
      setToken(savedToken);

      if (savedToken) {
        try {
          const res = await axios.get(`${API_BASE}/folders`, {
            headers: { Authorization: `Bearer ${savedToken}` }
          });
          if (res.data.success && res.data.folders) {
            setFolders(res.data.folders);
            // Auto-select relevant folder
            if (detectedType === 'image') {
              const imgFolder = res.data.folders.find(f => /image|screenshot|photo|design|asset/i.test(f.name));
              if (imgFolder) setSelectedFolder(imgFolder._id);
            } else if (detectedType === 'youtube') {
              const ytFolder = res.data.folders.find(f => /youtube|learning|video/i.test(f.name));
              if (ytFolder) setSelectedFolder(ytFolder._id);
            } else if (detectedType === 'link') {
              const bmFolder = res.data.folders.find(f => /bookmark|web|link/i.test(f.name));
              if (bmFolder) setSelectedFolder(bmFolder._id);
            }
          }
        } catch (err) {
          console.warn('Failed to load folders:', err);
        }
      }
      setLoading(false);
    }

    initShare();

    return () => {
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [searchParams]);

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!token) {
      setError('Please log in first to save items to your vault.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      let finalPreviewUrl = previewUrl;
      let finalUrl = url.trim();
      let finalMetadata = { ...metadata };
      let ocrText = '';

      // If a file (picture/screenshot/pdf) was shared, upload it first to the backend
      if (sharedFile && sharedFile.blob) {
        if (type === 'image') {
          const formData = new FormData();
          formData.append('image', sharedFile.blob, sharedFile.name || 'shared-screenshot.png');

          const uploadRes = await axios.post(`${API_BASE}/items/upload-image?ocr=true`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${token}`
            }
          });

          if (uploadRes.data.success) {
            finalPreviewUrl = uploadRes.data.imageUrl;
            finalUrl = uploadRes.data.imageUrl;
            ocrText = uploadRes.data.ocrText || '';
            finalMetadata = {
              ...finalMetadata,
              cloudinaryPublicId: uploadRes.data.cloudinaryPublicId,
              localFilename: uploadRes.data.localFilename,
              size: sharedFile.size,
              mimeType: sharedFile.type
            };
          } else {
            throw new Error(uploadRes.data.message || 'Image upload failed');
          }
        } else if (type === 'pdf') {
          const formData = new FormData();
          formData.append('pdf', sharedFile.blob, sharedFile.name || 'shared-document.pdf');

          const uploadRes = await axios.post(`${API_BASE}/items/upload-pdf`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${token}`
            }
          });

          if (uploadRes.data.success) {
            finalPreviewUrl = uploadRes.data.pdfUrl;
            finalUrl = uploadRes.data.pdfUrl;
            ocrText = uploadRes.data.extractedText || '';
            finalMetadata = {
              ...finalMetadata,
              size: sharedFile.size,
              totalPages: uploadRes.data.totalPages
            };
          } else {
            throw new Error(uploadRes.data.message || 'PDF upload failed');
          }
        }
      }

      const payload = {
        title: title.trim() || 'Shared Item',
        type,
        url: finalUrl,
        content: notes.trim(),
        ocrText,
        folderId: selectedFolder || null,
        previewUrl: finalPreviewUrl,
        metadata: finalMetadata,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean)
      };

      const res = await axios.post(`${API_BASE}/items`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setSavedSuccess(true);
      } else {
        throw new Error(res.data.message || 'Failed to save item');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error saving to vault');
    } finally {
      setSaving(false);
    }
  };

  const handleLoginRedirect = () => {
    router.push('/?auth=open');
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'image': return <ImageIcon size={14} color="#059669" />;
      case 'youtube': return <Tv size={14} color="#dc2626" />;
      case 'pdf': return <FileText size={14} color="#f43f5e" />;
      default: return <LinkIcon size={14} color="#2563eb" />;
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      background: 'var(--bg-primary)',
      color: 'var(--text-main)'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '440px',
        borderRadius: '18px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        boxShadow: '0 12px 36px rgba(0,0,0,0.45)',
        border: '1px solid var(--border-color)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800
            }}>
              ⚡
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Holder Mobile Share</h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Saving directly to your vault</p>
            </div>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '6px',
            background: 'rgba(37, 99, 235, 0.15)',
            border: '1px solid rgba(37, 99, 235, 0.3)',
            color: '#93c5fd',
            fontWeight: 600,
            textTransform: 'uppercase'
          }}>
            {getTypeIcon()}
            <span>{type}</span>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: 'rgba(220, 38, 38, 0.15)',
            border: '1px solid rgba(220, 38, 38, 0.4)',
            color: '#fca5a5',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Success View */}
        {savedSuccess ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            padding: '24px 12px',
            gap: '12px'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 16px rgba(5, 150, 105, 0.4)'
            }}>
              <Check size={28} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>Saved to Vault!</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              &quot;{title}&quot; is now archived and indexed with AI search.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px', width: '100%' }}>
              <button
                onClick={() => router.push('/')}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <span>Open Vault</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ) : !token ? (
          /* Not Logged In View */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            padding: '16px',
            gap: '12px'
          }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              You need to sign in once on this device to save shared items into your personal vault.
            </p>
            <button
              onClick={handleLoginRedirect}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                background: 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Sign In to Holder
            </button>
          </div>
        ) : (
          /* Active Save Form */
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Image / Screenshot Preview Card */}
            {type === 'image' && previewUrl && (
              <div style={{
                borderRadius: '12px',
                overflow: 'hidden',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                position: 'relative',
                maxHeight: '200px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px'
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={previewUrl} 
                  alt={title || 'Shared Screenshot'} 
                  style={{
                    maxWidth: '100%',
                    maxHeight: '190px',
                    borderRadius: '8px',
                    objectFit: 'contain'
                  }}
                />
                <span style={{
                  position: 'absolute',
                  bottom: '8px',
                  right: '8px',
                  background: 'rgba(0,0,0,0.7)',
                  backdropFilter: 'blur(4px)',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '6px'
                }}>
                  {sharedFile ? `${(sharedFile.size / (1024 * 1024)).toFixed(1)} MB` : 'Image'}
                </span>
              </div>
            )}

            {/* Title */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                TITLE
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="glass-input"
                style={{ width: '100%', fontSize: '13px' }}
              />
            </div>

            {/* URL preview if any */}
            {url && (
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                  LINK / MEDIA URL
                </label>
                <div style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  wordBreak: 'break-all'
                }}>
                  {url}
                </div>
              </div>
            )}

            {/* Folder Select */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                SAVE TO FOLDER
              </label>
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="glass-input"
                style={{ width: '100%', fontSize: '13px', background: 'var(--bg-primary)' }}
              >
                <option value="">📁 Uncategorized</option>
                {folders.map(f => (
                  <option key={f._id} value={f._id}>
                    {f.icon || '📁'} {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                TAGS (COMMA SEPARATED)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="glass-input"
                style={{ width: '100%', fontSize: '13px' }}
              />
            </div>

            {/* Notes */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                NOTES (OPTIONAL)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Add quick notes or thoughts..."
                className="glass-input"
                style={{ width: '100%', fontSize: '13px', resize: 'vertical' }}
              />
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={saving || loading}
              style={{
                marginTop: '6px',
                padding: '13px',
                borderRadius: '10px',
                background: 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                fontSize: '14px',
                cursor: saving ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
              }}
            >
              <Sparkles size={16} />
              <span>{saving ? 'Uploading & Indexing...' : 'Save to Vault'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-muted)',
        fontSize: '14px'
      }}>
        Loading mobile share...
      </div>
    }>
      <ShareContent />
    </Suspense>
  );
}
