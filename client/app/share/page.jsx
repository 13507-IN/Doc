'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { Sparkles, Check, ArrowRight, Folder, Tv, Link as LinkIcon, FileText, AlertCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function ShareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [token, setToken] = useState(null);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [type, setType] = useState('link');
  const [previewUrl, setPreviewUrl] = useState('');
  const [metadata, setMetadata] = useState({});
  const [tags, setTags] = useState('mobile');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState('');

  // Extract shared content from query params
  useEffect(() => {
    const rawTitle = searchParams.get('title') || '';
    const rawText = searchParams.get('text') || '';
    const rawUrl = searchParams.get('url') || '';

    // Mobile apps often put the link inside 'text' (e.g. YouTube app: "Watch this video: https://youtu.be/...")
    const urlRegex = /(https?:\/\/[^\s]+)/i;
    let extractedUrl = rawUrl;
    let remainingNotes = rawText;

    if (!extractedUrl && rawText) {
      const match = rawText.match(urlRegex);
      if (match) {
        extractedUrl = match[0];
        remainingNotes = rawText.replace(extractedUrl, '').trim();
      }
    }

    const isYouTube = extractedUrl.includes('youtube.com') || extractedUrl.includes('youtu.be');
    const detectedType = extractedUrl ? (isYouTube ? 'youtube' : 'link') : 'note';

    setUrl(extractedUrl);
    setType(detectedType);
    setTitle(rawTitle || (isYouTube ? 'Shared YouTube Video' : (extractedUrl ? 'Shared Link' : 'Shared Note')));
    setNotes(remainingNotes);
    setTags(isYouTube ? 'mobile, youtube' : 'mobile');

    // Fetch rich metadata if it's a URL
    if (extractedUrl) {
      axios.post(`${API_BASE}/metadata/extract`, { url: extractedUrl })
        .then(res => {
          if (res.data.success) {
            if (res.data.title && !rawTitle) setTitle(res.data.title);
            if (res.data.previewUrl) setPreviewUrl(res.data.previewUrl);
            if (res.data.metadata) setMetadata(res.data.metadata);
          }
        })
        .catch(() => {});
    }

    // Load auth token
    const savedToken = typeof window !== 'undefined' ? localStorage.getItem('holder_token') : null;
    setToken(savedToken);

    if (savedToken) {
      axios.get(`${API_BASE}/folders`, { headers: { Authorization: `Bearer ${savedToken}` } })
        .then(res => {
          if (res.data.success && res.data.folders) {
            setFolders(res.data.folders);
            // Auto-select relevant folder
            if (detectedType === 'youtube') {
              const ytFolder = res.data.folders.find(f => f.name.toLowerCase().includes('youtube') || f.name.toLowerCase().includes('learning'));
              if (ytFolder) setSelectedFolder(ytFolder._id);
            } else if (detectedType === 'link') {
              const bmFolder = res.data.folders.find(f => f.name.toLowerCase().includes('bookmark') || f.name.toLowerCase().includes('web'));
              if (bmFolder) setSelectedFolder(bmFolder._id);
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
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
      const payload = {
        title: title.trim() || 'Shared Item',
        type,
        url: url.trim(),
        content: notes.trim(),
        folderId: selectedFolder || null,
        previewUrl,
        metadata,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean)
      };

      const res = await axios.post(`${API_BASE}/items`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setSavedSuccess(true);
      } else {
        throw new Error(res.data.message || 'Failed to save');
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
          <span style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '6px',
            background: 'rgba(37, 99, 235, 0.15)',
            border: '1px solid rgba(37, 99, 235, 0.3)',
            color: '#93c5fd',
            fontWeight: 600,
            textTransform: 'uppercase'
          }}>
            {type}
          </span>
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
              &quot;{title}&quot; is now archived and indexed for your AI Assistant.
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
              disabled={saving}
              style={{
                marginTop: '6px',
                padding: '13px',
                borderRadius: '10px',
                background: 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
              }}
            >
              <Sparkles size={16} />
              <span>{saving ? 'Saving to Vault...' : 'Save to Vault'}</span>
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
