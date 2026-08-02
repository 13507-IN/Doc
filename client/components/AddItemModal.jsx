'use client';
import React, { useState, useEffect } from 'react';
import { 
  X, Tv, Image as ImageIcon, Link as LinkIcon, FileText, 
  Sparkles, Upload, Lock, Folder, Check
} from 'lucide-react';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

export default function AddItemModal({ isOpen, onClose, folders = [], onItemAdded, defaultFolderId }) {
  const [activeTab, setActiveTab] = useState('youtube'); // youtube | image | link | note
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [folderId, setFolderId] = useState(defaultFolderId || '');
  const [isPrivate, setIsPrivate] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [metadata, setMetadata] = useState({});

  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (defaultFolderId && defaultFolderId !== 'all' && defaultFolderId !== 'uncategorized') {
      setFolderId(defaultFolderId);
    }
  }, [defaultFolderId, isOpen]);

  // Handle URL change & auto extract metadata
  const handleUrlBlur = async () => {
    if (!url || (activeTab !== 'youtube' && activeTab !== 'link')) return;

    try {
      setLoadingMetadata(true);
      const res = await axios.post(`${API_BASE}/metadata/extract`, { url });
      if (res.data.success) {
        setTitle(res.data.title || title);
        setPreviewUrl(res.data.previewUrl || previewUrl);
        setMetadata(res.data.metadata || {});
        if (res.data.type === 'youtube' && activeTab !== 'youtube') {
          setActiveTab('youtube');
        }
      }
    } catch (err) {
      console.error('Metadata extraction error:', err);
    } finally {
      setLoadingMetadata(false);
    }
  };

  // Handle image file upload
  const handleImageFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('image', file);

      const res = await axios.post(`${API_BASE}/items/upload-image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        setPreviewUrl(res.data.imageUrl);
        if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    } catch (err) {
      console.error('Image upload error:', err);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title) return;

    try {
      setSubmitting(true);

      const payload = {
        title,
        type: activeTab,
        url,
        content,
        previewUrl,
        folderId: folderId || null,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        isPrivate,
        metadata
      };

      const res = await axios.post(`${API_BASE}/items`, payload);
      if (res.data.success) {
        onItemAdded(res.data.item);
        handleReset();
        onClose();
      }
    } catch (err) {
      console.error('Error creating item:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setUrl('');
    setTitle('');
    setContent('');
    setTags('');
    setPreviewUrl('');
    setMetadata({});
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '560px',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: '#fff' }}>
            Save New Item to Holder
          </h2>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Type Selector Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(10, 12, 22, 0.4)'
        }}>
          <TabBtn 
            active={activeTab === 'youtube'} 
            onClick={() => { setActiveTab('youtube'); handleReset(); }} 
            icon={<Tv size={16} color="#ef4444" />} 
            label="YouTube" 
          />
          <TabBtn 
            active={activeTab === 'image'} 
            onClick={() => { setActiveTab('image'); handleReset(); }} 
            icon={<ImageIcon size={16} color="#10b981" />} 
            label="Image" 
          />
          <TabBtn 
            active={activeTab === 'link'} 
            onClick={() => { setActiveTab('link'); handleReset(); }} 
            icon={<LinkIcon size={16} color="#3b82f6" />} 
            label="Web Link" 
          />
          <TabBtn 
            active={activeTab === 'note'} 
            onClick={() => { setActiveTab('note'); handleReset(); }} 
            icon={<FileText size={16} color="#f59e0b" />} 
            label="Note" 
          />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* URL Input for YouTube & Link */}
          {(activeTab === 'youtube' || activeTab === 'link') && (
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                {activeTab === 'youtube' ? 'YouTube Video URL' : 'Website URL'}
              </label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onBlur={handleUrlBlur}
                  placeholder={activeTab === 'youtube' ? 'https://www.youtube.com/watch?v=...' : 'https://example.com'}
                  className="glass-input"
                  style={{ width: '100%' }}
                  required
                />
                {loadingMetadata && (
                  <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--accent-primary)' }}>
                    Fetching metadata...
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Image Upload Input */}
          {activeTab === 'image' && (
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                Upload Image File or Paste Image URL
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="url"
                  value={previewUrl}
                  onChange={(e) => setPreviewUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="glass-input"
                  style={{ flex: 1 }}
                />
                <label style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-color)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Upload size={16} />
                  <span>{uploadingImage ? 'Uploading...' : 'Browse'}</span>
                  <input type="file" accept="image/*" onChange={handleImageFileChange} style={{ display: 'none' }} />
                </label>
              </div>
              {previewUrl && (
                <div style={{ marginTop: '10px', height: '100px', borderRadius: '10px', backgroundImage: `url(${previewUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
              Item Title *
            </label>
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Next.js Architecture Tutorial, Brand Logo, Wi-Fi Codes"
              className="glass-input"
              style={{ width: '100%' }}
              required
            />
          </div>

          {/* Content / Notes */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
              Notes / Description / Code Snippet
            </label>
            <textarea 
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add key takeaways, notes, or instructions..."
              className="glass-input"
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          {/* Folder & Tags */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                Select Folder
              </label>
              <select 
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="glass-input"
                style={{ width: '100%', cursor: 'pointer' }}
              >
                <option value="" style={{ background: '#121524' }}>📁 Uncategorized</option>
                {folders.map(f => (
                  <option key={f._id} value={f._id} style={{ background: '#121524' }}>
                    {f.icon || '📁'} {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                Tags (comma separated)
              </label>
              <input 
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="design, brand, video, react"
                className="glass-input"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Private Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '4px' }}>
            <input 
              type="checkbox"
              id="isPrivate"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              style={{ accentColor: 'var(--accent-pink)', cursor: 'pointer' }}
            />
            <label htmlFor="isPrivate" style={{ fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={14} color="#ec4899" />
              <span>Mark as Private / Sensitive Item</span>
            </label>
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button 
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={submitting}
              style={{
                padding: '10px 24px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--accent-primary) 0%, #4f46e5 100%)',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
              }}
            >
              {submitting ? 'Saving...' : 'Save to Vault'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }) {
  return (
    <button 
      type="button"
      onClick={onClick}
      style={{
        padding: '12px',
        background: active ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
        color: active ? '#fff' : 'var(--text-muted)',
        fontWeight: active ? 600 : 500,
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        cursor: 'pointer'
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
