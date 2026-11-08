'use client';
import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Tv, Image as ImageIcon, Link as LinkIcon, FileText, 
  Upload, Lock, AlertCircle, Loader2, Sparkles, Check
} from 'lucide-react';
import axios from 'axios';
import usePrivateMediaUrl from '../utils/usePrivateMediaUrl';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Fast client-side image compressor: turns large 10-15MB mobile PNG screenshots into ~300KB in ~30ms
async function compressImageClientSide(file) {
  if (typeof window === 'undefined' || !file) return file;
  const isImage = file.type ? file.type.startsWith('image/') : true;
  if (!isImage || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }
  // If already under 400 KB, no need to compress further
  if (file.size && file.size < 400 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX_DIM = 1920;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressed = new File([blob], file.name ? file.name.replace(/\.[^.]+$/, '.jpg') : 'screenshot.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(compressed);
        }, 'image/jpeg', 0.88);
      };
      img.onerror = () => resolve(file);
      img.src = objectUrl;
    } catch {
      resolve(file);
    }
  });
}

export default function AddItemModal({ isOpen, onClose, folders = [], onItemAdded, defaultFolderId, editingItem, prefillUrl, initialPastedFile, token }) {
  const [activeTab, setActiveTab] = useState('youtube'); // youtube | image | pdf | link | note
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [folderId, setFolderId] = useState(defaultFolderId || '');
  const [isPrivate, setIsPrivate] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [stagedUpload, setStagedUpload] = useState(null);
  const [metadata, setMetadata] = useState({});
  const [expiresAt, setExpiresAt] = useState('');
  const [reminderDays, setReminderDays] = useState(30);
  const [ocrText, setOcrText] = useState('');

  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfFileSize, setPdfFileSize] = useState('');

  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [storageNotice, setStorageNotice] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [autoTagging, setAutoTagging] = useState(false);
  const [aiNotice, setAiNotice] = useState('');
  const [localImagePreview, setLocalImagePreview] = useState('');
  const [localImageName, setLocalImageName] = useState('');
  const [localImageSize, setLocalImageSize] = useState('');
  const lastExtractedUrlRef = useRef('');

  const isEditing = Boolean(editingItem);
  const activeToken = token || (typeof window !== 'undefined' ? (localStorage.getItem('holder_token') || localStorage.getItem('token')) : null);
  const privateImagePreview = usePrivateMediaUrl(
    stagedUpload?.type === 'image'
      ? stagedUpload.mediaUrl
      : (isEditing && activeTab === 'image' ? editingItem?.mediaUrl : null),
    activeToken
  );
  const effectiveImagePreview = localImagePreview || privateImagePreview || previewUrl || (isEditing && activeTab === 'image' ? (editingItem?.mediaUrl || editingItem?.previewUrl) : '');

  const releaseStagedUpload = async (uploadId) => {
    if (!uploadId || !activeToken) return;
    try {
      await axios.delete(`${API_BASE}/uploads/${uploadId}`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
    } catch (error) {
      if (error.response?.status !== 404) {
        console.warn('[Holder] Staged media will be removed automatically after it expires.');
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      lastExtractedUrlRef.current = '';
      return;
    }
    lastExtractedUrlRef.current = '';
    const timer = window.setTimeout(() => {
      if (editingItem) {
        setStagedUpload(null);
        setActiveTab(editingItem.type);
        setUrl(editingItem.url || '');
        setTitle(editingItem.title || '');
        setContent(editingItem.content || '');
        setTags((editingItem.tags || []).join(', '));
        setFolderId(editingItem.folderId?._id || editingItem.folderId || '');
        setIsPrivate(Boolean(editingItem.isPrivate));
        setPreviewUrl(editingItem.previewUrl || '');
        setMetadata(editingItem.metadata || {});
        setExpiresAt(editingItem.expiresAt ? editingItem.expiresAt.slice(0, 10) : '');
        setReminderDays(editingItem.reminderDays ?? 30);
        setOcrText(editingItem.ocrText || '');
        setPdfFileName(
          editingItem.metadata?.filename ||
          (editingItem.type === 'pdf' && editingItem.url ? editingItem.url.split('/').pop().split('?')[0] : '')
        );
        setPdfFileSize(
          editingItem.metadata?.size
            ? editingItem.metadata.size > 1024 * 1024
              ? (editingItem.metadata.size / (1024 * 1024)).toFixed(1) + ' MB'
              : Math.round(editingItem.metadata.size / 1024) + ' KB'
            : ''
        );
        return;
      }

      if (prefillUrl) {
        setStagedUpload(null);
        const isYt = prefillUrl.includes('youtube.com') || prefillUrl.includes('youtu.be');
        const isPdf = prefillUrl.toLowerCase().endsWith('.pdf');
        setActiveTab(isYt ? 'youtube' : (isPdf ? 'pdf' : 'link'));
        setUrl(prefillUrl);
        setTitle('');
        setContent('');
        setTags(isYt ? 'youtube, video' : 'link');
        setFolderId(
          defaultFolderId && defaultFolderId !== 'all' && defaultFolderId !== 'uncategorized'
            ? defaultFolderId
            : ''
        );
        setIsPrivate(false);
        setPreviewUrl('');
        setMetadata({});
        setExpiresAt('');
        setReminderDays(30);
        setOcrText('');
        setPdfFileName('');
        setPdfFileSize('');
        setSaveError('');
        setStorageNotice('');
        setDuplicateWarning('');

        // Auto-extract metadata for prefilled URL
        axios.post(`${API_BASE}/metadata/extract`, { url: prefillUrl }).then(res => {
          if (res.data.success) {
            setTitle(res.data.title || '');
            setPreviewUrl(res.data.previewUrl || '');
            setMetadata(res.data.metadata || {});
            if (res.data.suggestedTags?.length > 0) setTags(res.data.suggestedTags.join(', '));
            if (folders && folders.length > 0) {
              if (res.data.suggestedFolderType === 'youtube') {
                const match = folders.find(f => /youtube|learning|video/i.test(f.name));
                if (match) setFolderId(match._id);
              } else if (res.data.suggestedFolderType === 'brand') {
                const match = folders.find(f => /brand|asset|design/i.test(f.name));
                if (match) setFolderId(match._id);
              } else if (res.data.suggestedFolderType === 'web') {
                const match = folders.find(f => /bookmark|web|link/i.test(f.name));
                if (match) setFolderId(match._id);
              }
            }
          }
        }).catch(() => {});
        return;
      }

      setActiveTab('youtube');
      setStagedUpload(null);
      setUrl('');
      setTitle('');
      setContent('');
      setTags('');
      setFolderId(
        defaultFolderId && defaultFolderId !== 'all' && defaultFolderId !== 'uncategorized'
          ? defaultFolderId
          : ''
      );
      setIsPrivate(false);
      setPreviewUrl('');
      setMetadata({});
      setExpiresAt('');
      setReminderDays(30);
      setOcrText('');
      setPdfFileName('');
      setPdfFileSize('');
      setSaveError('');
      setStorageNotice('');
      setDuplicateWarning('');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [defaultFolderId, editingItem, prefillUrl, isOpen]);

  // Handle URL change & auto extract metadata immediately
  const extractMetadataForUrl = async (targetUrl) => {
    const rawUrl = (targetUrl !== undefined ? targetUrl : url)?.trim();
    if (!rawUrl || (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://'))) return;
    if (lastExtractedUrlRef.current === rawUrl) return;

    if (activeTab === 'pdf' || rawUrl.toLowerCase().endsWith('.pdf')) {
      try {
        const rawEnd = rawUrl.split('/').pop().split('?')[0];
        const cleanName = decodeURIComponent(rawEnd || 'document.pdf');
        const clean = cleanName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
        if (clean && !title) setTitle(clean);
        if (cleanName && !pdfFileName) setPdfFileName(cleanName);
        if (activeTab !== 'pdf') setActiveTab('pdf');
      } catch {}
      return;
    }

    try {
      lastExtractedUrlRef.current = rawUrl;
      setLoadingMetadata(true);
      const res = await axios.post(`${API_BASE}/metadata/extract`, { url: rawUrl });
      if (res.data.success) {
        setTitle(res.data.title || title);
        setPreviewUrl(res.data.previewUrl || previewUrl);
        setMetadata(res.data.metadata || {});
        if (res.data.type === 'youtube' && activeTab !== 'youtube') {
          setActiveTab('youtube');
        } else if (res.data.type === 'pdf' && activeTab !== 'pdf') {
          setActiveTab('pdf');
        }

        // Auto-suggest tags if tags field is empty
        if (!tags && res.data.suggestedTags?.length > 0) {
          setTags(res.data.suggestedTags.join(', '));
        }

        // Auto-select folder if not explicitly chosen
        if (!folderId && folders.length > 0) {
          if (res.data.suggestedFolderType === 'youtube') {
            const match = folders.find(f => /youtube|learning|video/i.test(f.name));
            if (match) setFolderId(match._id);
          } else if (res.data.suggestedFolderType === 'brand') {
            const match = folders.find(f => /brand|asset|design/i.test(f.name));
            if (match) setFolderId(match._id);
          } else if (res.data.suggestedFolderType === 'web') {
            const match = folders.find(f => /bookmark|web|link/i.test(f.name));
            if (match) setFolderId(match._id);
          }
        }
      }
    } catch (err) {
      console.error('Metadata extraction error:', err);
    } finally {
      setLoadingMetadata(false);
    }
  };

  // AI Auto-File & Smart Tagger: analyzes content with Cloudflare Workers AI
  const handleAiAutoDetect = async (overridePayload = {}) => {
    if (autoTagging) return;
    const textToAnalyze = overridePayload.text || ocrText || content || metadata?.description || '';
    const urlToAnalyze = overridePayload.url || url || '';
    const titleToAnalyze = overridePayload.title || title || '';

    if (!textToAnalyze && !urlToAnalyze && !titleToAnalyze) {
      return;
    }

    setAutoTagging(true);
    setAiNotice('');
    try {
      const res = await axios.post(`${API_BASE}/items/suggest-tags`, {
        text: textToAnalyze,
        url: urlToAnalyze,
        title: titleToAnalyze
      }, {
        headers: { Authorization: `Bearer ${activeToken}` },
        timeout: 15000
      });

      if (res.data?.success) {
        let appliedAny = false;
        // Auto-suggest title if current title is empty or generic
        if (res.data.title && (!title || /^Screenshot/i.test(title) || /^img-/i.test(title) || /^file/i.test(title))) {
          setTitle(res.data.title);
          appliedAny = true;
        }

        // Auto-suggest tags
        if (Array.isArray(res.data.tags) && res.data.tags.length > 0) {
          const currentTags = tags ? tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean) : [];
          const merged = [...new Set([...currentTags, ...res.data.tags.map((t) => t.toLowerCase())])];
          setTags(merged.join(', '));
          appliedAny = true;
        }

        // Auto-select folder if not currently chosen
        if (res.data.folderId && (!folderId || folderId === 'null' || folderId === 'undefined')) {
          setFolderId(res.data.folderId);
          appliedAny = true;
        }

        if (appliedAny) {
          const folderMsg = res.data.folderName ? ` -> ${res.data.folderName}` : '';
          setAiNotice(`AI auto-tagged${folderMsg}`);
          window.setTimeout(() => setAiNotice(''), 4500);
        }
      }
    } catch (err) {
      console.warn('[AutoTagger] Suggestion failed:', err.message);
    } finally {
      setAutoTagging(false);
    }
  };

  // Debounced auto-extractor: starts fetching within 350ms of pasting or typing a URL
  useEffect(() => {
    if (!isOpen) return;
    const clean = url?.trim();
    if (!clean || (!clean.startsWith('http://') && !clean.startsWith('https://'))) {
      return;
    }
    const timer = setTimeout(() => {
      extractMetadataForUrl(clean);
    }, 350);
    return () => clearTimeout(timer);
  }, [url, isOpen]);

  // Process image with client-side compression and upload with fast OCR
  const processAndUploadImage = async (rawFile) => {
    if (!rawFile) return;

    // Generate immediate client-side instant preview before network upload
    try {
      if (localImagePreview) {
        URL.revokeObjectURL(localImagePreview);
      }
      const objUrl = URL.createObjectURL(rawFile);
      setLocalImagePreview(objUrl);
      setLocalImageName(rawFile.name || 'Pasted Image');
      setLocalImageSize(
        rawFile.size > 1024 * 1024
          ? (rawFile.size / (1024 * 1024)).toFixed(1) + ' MB'
          : Math.round(rawFile.size / 1024) + ' KB'
      );
    } catch (e) {
      console.warn('[Holder] Local object URL generation failed:', e);
    }

    try {
      setUploadingImage(true);
      setSaveError('');
      const file = await compressImageClientSide(rawFile);
      const formData = new FormData();
      formData.append('image', file);

      const res = await axios.post(`${API_BASE}/items/upload-image?ocr=true`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${activeToken}`
        },
        timeout: 30000
      });

      if (res.data.success) {
        if (res.data.storage === 'local') {
          console.warn('[Holder] Image stored on server-local storage.', res.data.storageWarning);
          setStorageNotice(res.data.storageWarning || 'Stored on server-local storage (Cloudinary not configured on this host).');
        } else {
          setStorageNotice('');
        }
        await releaseStagedUpload(stagedUpload?.uploadId);
        setStagedUpload({
          uploadId: res.data.uploadId,
          mediaUrl: res.data.mediaUrl,
          type: 'image'
        });
        setMetadata((current) => ({
          ...current,
          ...(res.data.ocrText ? { ocrPreview: res.data.ocrText.slice(0, 160) } : {})
        }));
        if (res.data.ocrText) {
          setOcrText(res.data.ocrText);
          void handleAiAutoDetect({ text: res.data.ocrText });
        }
        if (!title) {
          const rawName = rawFile.name ? rawFile.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, ' ').trim() : '';
          setTitle(rawName || `Screenshot — ${new Date().toLocaleDateString()}`);
        }
      }
    } catch (err) {
      console.error('Image upload error:', err);
      setSaveError(err.response?.data?.message || 'Could not upload this image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Handle image file upload from input
  const handleImageFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await processAndUploadImage(file);
  };

  // Watch for initial pasted file prop when opening modal
  useEffect(() => {
    if (isOpen && initialPastedFile) {
      setActiveTab('image');
      processAndUploadImage(initialPastedFile);
    }
  }, [isOpen, initialPastedFile]);

  // Handle clipboard paste inside modal
  useEffect(() => {
    if (!isOpen) return;

    const handleModalPaste = (e) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      for (let i = 0; i < clipboardItems.length; i++) {
        if (clipboardItems[i].type.indexOf('image') !== -1) {
          const blob = clipboardItems[i].getAsFile();
          if (blob) {
            e.preventDefault();
            setActiveTab('image');
            processAndUploadImage(blob);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handleModalPaste);
    return () => window.removeEventListener('paste', handleModalPaste);
  }, [isOpen, token, title]);

  // Handle PDF file upload
  const handlePdfFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploadingPdf(true);
      const formData = new FormData();
      formData.append('pdf', file);

      const res = await axios.post(`${API_BASE}/items/upload-pdf`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${activeToken}`
        },
        timeout: 30000
      });

      if (res.data.success) {
        await releaseStagedUpload(stagedUpload?.uploadId);
        setStagedUpload({
          uploadId: res.data.uploadId,
          mediaUrl: res.data.mediaUrl,
          type: 'pdf'
        });
        setUrl('');
        setPreviewUrl('');
        setPdfFileName(res.data.filename);
        const formattedSize = res.data.size > 1024 * 1024
          ? (res.data.size / (1024 * 1024)).toFixed(1) + ' MB'
          : Math.round(res.data.size / 1024) + ' KB';
        setPdfFileSize(formattedSize);

        setMetadata((current) => ({
          ...current,
          filename: res.data.filename,
          size: res.data.size,
          storageType: res.data.storageType
        }));

        if (!title) {
          const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, ' ').trim();
          setTitle(cleanTitle);
        }
      }
    } catch (err) {
      console.error('PDF upload error:', err);
      setSaveError(err.response?.data?.message || 'Could not upload this PDF. Please try again.');
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleSubmit = async (e, forceSave = false) => {
    if (e) e.preventDefault();
    if (!title) return;

    if (activeTab === 'pdf' && !url && stagedUpload?.type !== 'pdf') {
      setSaveError('Please upload a PDF document or enter a PDF URL before saving.');
      return;
    }

    try {
      setSaveError('');
      setStorageNotice('');
      setDuplicateWarning('');
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
        metadata,
        expiresAt: expiresAt || null,
        reminderDays: Number(reminderDays) || 30,
        ocrText,
        allowDuplicate: Boolean(forceSave)
      };
      if (stagedUpload?.type === activeTab) {
        payload.uploadId = stagedUpload.uploadId;
      }

      const request = isEditing
        ? axios.put(`${API_BASE}/items/${editingItem._id}`, payload, {
            headers: { 'Authorization': `Bearer ${activeToken}` },
            timeout: 30000
          })
        : axios.post(`${API_BASE}/items`, payload, {
            headers: { 'Authorization': `Bearer ${activeToken}` },
            timeout: 30000
          });
      const res = await request;

      if (res.data.success) {
        onItemAdded(res.data.item);
        handleReset();
        onClose();
      }
    } catch (err) {
      console.error('Error creating item:', err);
      if (err.response?.status === 409 && err.response?.data?.isDuplicate) {
        setDuplicateWarning(err.response.data.message);
      } else {
        setSaveError(err.response?.data?.message || 'Could not save this item. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearImage = () => {
    if (localImagePreview) {
      URL.revokeObjectURL(localImagePreview);
      setLocalImagePreview('');
    }
    setLocalImageName('');
    setLocalImageSize('');
    setPreviewUrl('');
    setOcrText('');
    setStorageNotice('');
    void releaseStagedUpload(stagedUpload?.uploadId);
    setStagedUpload(null);
  };

  const handleReset = () => {
    void releaseStagedUpload(stagedUpload?.uploadId);
    setStagedUpload(null);
    if (localImagePreview) {
      URL.revokeObjectURL(localImagePreview);
      setLocalImagePreview('');
    }
    setLocalImageName('');
    setLocalImageSize('');
    setUrl('');
    setTitle('');
    setContent('');
    setTags('');
    setPreviewUrl('');
    setMetadata({});
    setPdfFileName('');
    setPdfFileSize('');
    setOcrText('');
    setStorageNotice('');
    setSaveError('');
    setDuplicateWarning('');
  };

  const handleClose = () => {
    void releaseStagedUpload(stagedUpload?.uploadId);
    setStagedUpload(null);
    if (localImagePreview) {
      URL.revokeObjectURL(localImagePreview);
      setLocalImagePreview('');
    }
    setLocalImageName('');
    setLocalImageSize('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      onMouseDown={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflow: 'hidden'
      }}
    >
      <div 
        className="glass-panel animate-scale-in" 
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '580px',
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
          border: '1px solid var(--border-color)',
          background: 'var(--bg-secondary, #111827)'
        }}
      >
        {/* Header - Fixed at top */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>
            {isEditing ? 'Edit Vault Item' : 'Save New Item to Holder'}
          </h2>
          <button 
            type="button"
            onClick={handleClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Type Selector Tabs - Fixed at top */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(10, 12, 22, 0.5)',
          flexShrink: 0
        }}>
          <TabBtn 
            active={activeTab === 'youtube'} 
            onClick={() => { setActiveTab('youtube'); if (!isEditing) handleReset(); }}
            icon={<Tv size={15} color="#ef4444" />} 
            label="YouTube" 
          />
          <TabBtn 
            active={activeTab === 'image'} 
            onClick={() => { setActiveTab('image'); if (!isEditing) handleReset(); }}
            icon={<ImageIcon size={15} color="#10b981" />} 
            label="Image" 
          />
          <TabBtn 
            active={activeTab === 'pdf'} 
            onClick={() => { setActiveTab('pdf'); if (!isEditing) handleReset(); }}
            icon={<FileText size={15} color="#f43f5e" />} 
            label="PDF" 
          />
          <TabBtn 
            active={activeTab === 'link'} 
            onClick={() => { setActiveTab('link'); if (!isEditing) handleReset(); }}
            icon={<LinkIcon size={15} color="#3b82f6" />} 
            label="Link" 
          />
          <TabBtn 
            active={activeTab === 'note'} 
            onClick={() => { setActiveTab('note'); if (!isEditing) handleReset(); }}
            icon={<FileText size={15} color="#f59e0b" />} 
            label="Note" 
          />
        </div>

        {/* Form */}
        <form 
          onSubmit={handleSubmit} 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            flex: 1, 
            minHeight: 0, 
            overflow: 'hidden',
            margin: 0
          }}
        >
          {/* Scrollable Form Body */}
          <div style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
          
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
                  onPaste={(e) => {
                    const pasted = e.clipboardData?.getData('text')?.trim();
                    if (pasted && (pasted.startsWith('http://') || pasted.startsWith('https://'))) {
                      setUrl(pasted);
                      extractMetadataForUrl(pasted);
                    }
                  }}
                  onBlur={() => extractMetadataForUrl(url)}
                  placeholder={activeTab === 'youtube' ? 'https://www.youtube.com/watch?v=...' : 'https://example.com'}
                  className="glass-input"
                  style={{ width: '100%', paddingRight: loadingMetadata ? '135px' : '14px' }}
                  required
                />
                {loadingMetadata && (
                  <span style={{ 
                    position: 'absolute', 
                    right: '12px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    fontSize: '11px', 
                    fontWeight: 500,
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    pointerEvents: 'none'
                  }}>
                    <Loader2 size={13} className="animate-spin" />
                    Fetching preview...
                  </span>
                )}
              </div>
            </div>
          )}

          {/* PDF Upload / Link Input */}
          {activeTab === 'pdf' && (
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                Upload PDF Document or Paste Online PDF URL
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setMetadata((current) => {
                      const next = { ...current };
                      delete next.cloudinaryPublicId;
                      delete next.localFilename;
                      return next;
                    });
                  }}
                  onBlur={() => extractMetadataForUrl(url)}
                  placeholder="https://example.com/sample.pdf"
                  className="glass-input"
                  style={{ flex: 1 }}
                />
                <label style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(225, 29, 72, 0.15)',
                  border: '1px solid rgba(225, 29, 72, 0.3)',
                  color: '#fda4af',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}>
                  <Upload size={16} />
                  <span>{uploadingPdf ? 'Uploading...' : 'Browse PDF'}</span>
                  <input type="file" accept="application/pdf,.pdf" onChange={handlePdfFileChange} style={{ display: 'none' }} />
                </label>
              </div>

              {url && (
                <div style={{
                  marginTop: '10px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(225, 29, 72, 0.08)',
                  border: '1px solid rgba(225, 29, 72, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <FileText size={20} color="#f43f5e" style={{ flexShrink: 0 }} />
                    <div style={{ overflow: 'hidden' }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {pdfFileName || url.split('/').pop().split('?')[0] || 'Attached PDF Document'}
                      </p>
                      {pdfFileSize && (
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          File size: {pdfFileSize}
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '12px', color: '#fda4af', textDecoration: 'underline' }}
                    >
                      Preview
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setUrl('');
                        setPdfFileName('');
                        setPdfFileSize('');
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-dim)',
                        cursor: 'pointer',
                        padding: '2px'
                      }}
                      title="Remove PDF"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}
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
                  onChange={(e) => {
                    setPreviewUrl(e.target.value);
                    void releaseStagedUpload(stagedUpload?.uploadId);
                    setStagedUpload(null);
                    setMetadata((current) => {
                      const next = { ...current };
                      delete next.cloudinaryPublicId;
                      delete next.localFilename;
                      return next;
                    });
                  }}
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
              {effectiveImagePreview && (
                <div style={{
                  marginTop: '12px',
                  background: '#0b111c',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                }}>
                  {/* Image Display */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '10px',
                    maxHeight: '220px',
                    background: 'radial-gradient(circle at center, rgba(30, 41, 59, 0.4) 0%, rgba(11, 17, 28, 0.8) 100%)'
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={effectiveImagePreview}
                      alt="Image preview"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '200px',
                        objectFit: 'contain',
                        borderRadius: '8px',
                        display: 'block'
                      }}
                    />
                  </div>

                  {/* Info & action bar */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'rgba(15, 23, 42, 0.75)',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    fontSize: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
                      <ImageIcon size={14} color="#60a5fa" style={{ flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff', fontWeight: 500, fontSize: '12px' }}>
                        {localImageName || (isEditing ? editingItem?.title : 'Image Preview')}
                      </span>
                      {localImageSize && (
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)', background: 'rgba(255, 255, 255, 0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                          {localImageSize}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {uploadingImage && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#60a5fa', fontSize: '11px', fontWeight: 600 }}>
                          <Loader2 size={12} className="animate-spin" />
                          <span>Reading text...</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleClearImage}
                        style={{
                          background: 'rgba(239, 68, 68, 0.12)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#f87171',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Remove image"
                      >
                        <X size={12} />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {storageNotice && (
                <div style={{
                  marginTop: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(234, 179, 8, 0.1)',
                  border: '1px solid rgba(234, 179, 8, 0.25)',
                  borderRadius: '8px',
                  padding: '7px 10px',
                  fontSize: '11px',
                  color: '#facc15',
                  lineHeight: '1.4'
                }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{storageNotice}</span>
                </div>
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
              placeholder={activeTab === 'pdf' ? 'e.g. Q3 Financial Statement, Research Paper, Architecture Spec' : 'e.g. Next.js Architecture Tutorial, Brand Logo, Wi-Fi Codes'}
              className="glass-input"
              style={{ width: '100%' }}
              required
            />
          </div>

          {/* Content / Notes */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
              {activeTab === 'pdf' ? 'Document Notes / Key Points / Summary' : 'Notes / Description / Code Snippet'}
            </label>
            <textarea 
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={activeTab === 'pdf' ? 'Add key points, document summary, page references...' : 'Add key takeaways, notes, or instructions...'}
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
                <option value="" style={{ background: '#121524', color: '#f8fafc' }}>Uncategorized</option>
                {folders.map(f => (
                  <option key={f._id} value={f._id} style={{ background: '#121524', color: '#f8fafc' }}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Tags (comma separated)
                </label>
                <button
                  type="button"
                  onClick={() => handleAiAutoDetect()}
                  disabled={autoTagging}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#60a5fa',
                    cursor: autoTagging ? 'wait' : 'pointer',
                    fontSize: '11px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}
                  title="Auto-suggest title, tags, and best folder using AI"
                >
                  {autoTagging ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                  <span>{autoTagging ? 'Tagging...' : 'AI Auto-Detect'}</span>
                </button>
              </div>
              <input 
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder={activeTab === 'pdf' ? 'pdf, contract, report, paper' : 'design, brand, video, react'}
                className="glass-input"
                style={{ width: '100%' }}
              />
              {aiNotice && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '5px',
                  color: '#34d399',
                  fontSize: '11px',
                  fontWeight: 600
                }}>
                  <Check size={12} />
                  <span>{aiNotice}</span>
                </div>
              )}
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
              <span>Mark as sensitive</span>
            </label>
          </div>
          <p style={{ marginTop: '-4px', fontSize: '11px', color: 'var(--text-muted)' }}>
            This label is for organization; it does not encrypt the item or add another access check.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>Expiry date</label>
              <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="glass-input" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>Alert days</label>
              <input type="number" min="0" max="365" value={reminderDays} onChange={(e) => setReminderDays(e.target.value)} className="glass-input" style={{ width: '100%' }} />
            </div>
          </div>

          {duplicateWarning && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'rgba(217, 119, 6, 0.15)',
              border: '1px solid rgba(217, 119, 6, 0.4)',
              color: '#fde047',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              marginTop: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} color="#d97706" style={{ flexShrink: 0 }} />
                <span>{duplicateWarning}</span>
              </div>
              <button
                type="button"
                onClick={() => handleSubmit(null, true)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  background: '#d97706',
                  color: '#fff',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Save Anyway
              </button>
            </div>
          )}

          </div>

          {/* Submit Footer - Pinned at bottom */}
          <div style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-color)',
            background: 'rgba(11, 15, 25, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexShrink: 0
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {saveError && (
                <p role="alert" style={{ margin: 0, color: '#fda4af', fontSize: '12px', lineHeight: 1.4 }}>
                  {saveError}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
              <button 
                type="button"
                onClick={handleClose}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500
                }}
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={submitting}
                style={{
                  padding: '9px 22px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, var(--accent-primary) 0%, #4f46e5 100%)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
                }}
              >
                {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Save to Vault'}
              </button>
            </div>
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
        padding: '12px 6px',
        background: active ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
        color: active ? '#fff' : 'var(--text-muted)',
        fontWeight: active ? 600 : 500,
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '5px',
        cursor: 'pointer',
        whiteSpace: 'nowrap'
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
