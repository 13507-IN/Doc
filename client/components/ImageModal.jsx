'use client';
import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Copy, Check, Globe, Sparkles, Loader2, Tag } from 'lucide-react';
import ClickableText from './ClickableText';
import { extractUrlsFromText, getWebsiteUrlForItem, ensureAbsoluteUrl } from '../utils/urlHelper';
import usePrivateMediaUrl from '../utils/usePrivateMediaUrl';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function ImageModal({ item, onClose, onItemUpdated, token }) {
  const [copied, setCopied] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [autoTagging, setAutoTagging] = useState(false);
  const [transcribeError, setTranscribeError] = useState('');
  const [currentItem, setCurrentItem] = useState(item);

  useEffect(() => {
    setCurrentItem(item);
  }, [item]);

  const activeToken = token || (typeof window !== 'undefined' ? (localStorage.getItem('holder_token') || localStorage.getItem('token')) : null);

  // Poll for background OCR completion when status is processing or pending
  useEffect(() => {
    if (!currentItem?._id) return;
    if (currentItem.ocrStatus !== 'processing' && currentItem.ocrStatus !== 'pending') return;

    let isCancelled = false;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/items/${currentItem._id}`, {
          headers: {
            'Authorization': `Bearer ${activeToken}`
          }
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (data?.success && data?.item && !isCancelled) {
          if (data.item.ocrStatus === 'done' || data.item.ocrStatus === 'failed') {
            setCurrentItem(data.item);
            if (onItemUpdated) {
              onItemUpdated(data.item);
            }
          }
        }
      } catch (e) {
        console.warn('[ImageModal] OCR polling check:', e.message);
      }
    }, 2500);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [currentItem?._id, currentItem?.ocrStatus, activeToken, onItemUpdated]);

  const imageSrc = usePrivateMediaUrl(
    currentItem?.mediaUrl || currentItem?.previewUrl || currentItem?.url || currentItem?.content
  );

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!currentItem) return null;

  // Extract all detected website URLs from the screenshot
  const primaryWebsiteUrl = getWebsiteUrlForItem(currentItem);
  const allOcrUrls = extractUrlsFromText(currentItem.ocrText);
  const detectedUrls = Array.from(new Set([
    ...(primaryWebsiteUrl ? [primaryWebsiteUrl] : []),
    ...(currentItem.metadata?.detectedUrls || []),
    ...allOcrUrls
  ].map(ensureAbsoluteUrl)));

  const copyOcr = async () => {
    if (!currentItem.ocrText) return;
    await navigator.clipboard.writeText(currentItem.ocrText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleTranscribeVision = async () => {
    if (transcribing || !currentItem?._id) return;
    setTranscribing(true);
    setTranscribeError('');
    try {
      const res = await fetch(`${API_BASE}/items/${currentItem._id}/transcribe-vision`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeToken}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Vision transcription failed');
      }
      if (data.item) {
        setCurrentItem(data.item);
        if (onItemUpdated) {
          onItemUpdated(data.item);
        }
      }
    } catch (err) {
      setTranscribeError(err.message || 'Failed to transcribe handwriting');
    } finally {
      setTranscribing(false);
    }
  };

  const handleAutoTag = async () => {
    if (autoTagging || !currentItem?._id) return;
    setAutoTagging(true);
    setTranscribeError('');
    try {
      const res = await fetch(`${API_BASE}/items/${currentItem._id}/auto-tag`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeToken}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Auto-tagging failed');
      }
      if (data.item) {
        setCurrentItem(data.item);
        if (onItemUpdated) {
          onItemUpdated(data.item);
        }
      }
    } catch (err) {
      setTranscribeError(err.message || 'Failed to auto-tag item');
    } finally {
      setAutoTagging(false);
    }
  };

  const ocrEngine = currentItem.metadata?.ocrEngine;
  const isVisionEngine = ocrEngine === 'cloudflare-workers-ai' || ocrEngine === 'gemini-vision';
  const isProcessingOcr = currentItem.ocrStatus === 'processing' || currentItem.ocrStatus === 'pending';

  return (
    <div onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(0, 0, 0, 0.9)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div onMouseDown={(event) => event.stopPropagation()} style={{
        maxWidth: '90vw',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        maxWidth: '780px'
      }}>
        {/* Header toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', color: '#fff' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 600 }}>{currentItem.title}</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            {imageSrc && <a href={imageSrc} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)' }} title="Open Original Image">
              <ExternalLink size={18} />
            </a>}
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Actionable Detected Links Banner */}
        {detectedUrls.length > 0 && (
          <div style={{
            width: '100%',
            background: 'rgba(37, 99, 235, 0.15)',
            border: '1px solid rgba(37, 99, 235, 0.4)',
            borderRadius: '12px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
              <Globe size={18} color="#60a5fa" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>
                  Website Link in Screenshot
                </span>
                <span style={{ fontSize: '13px', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                  {detectedUrls[0]}
                </span>
              </div>
            </div>

            <a
              href={detectedUrls[0]}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--accent-primary)',
                color: '#fff',
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
                cursor: 'pointer'
              }}
            >
              <span>Visit Website</span>
              <ExternalLink size={13} />
            </a>
          </div>
        )}

        {/* Image Display */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc || undefined}
          hidden={!imageSrc}
          alt={currentItem.title} 
          style={{
            maxWidth: '100%',
            maxHeight: detectedUrls.length > 0 ? '55vh' : '65vh',
            borderRadius: '12px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            objectFit: 'contain'
          }}
        />
        {!imageSrc && (
          <p role="status" style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            {currentItem.mediaUrl ? 'Loading private image…' : 'Image unavailable.'}
          </p>
        )}

        {/* OCR / Vision HTR Extracted Text */}
        <div className="glass-panel" style={{ width: '100%', padding: '12px 14px', borderRadius: '10px' }}>
          {/* Background Reading Progress Banner */}
          {isProcessingOcr && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              marginBottom: '10px',
              borderRadius: '8px',
              background: 'rgba(37, 99, 235, 0.15)',
              border: '1px solid rgba(37, 99, 235, 0.35)',
              color: '#93c5fd',
              fontSize: '12px',
              fontWeight: 500
            }}>
              <Loader2 size={14} className="animate-spin" style={{ flexShrink: 0 }} />
              <span>Reading text & handwriting with AI in the background...</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '12px', color: '#fff' }}>Extracted Text</strong>
              {isProcessingOcr ? (
                <span style={{
                  fontSize: '10px',
                  background: 'rgba(37, 99, 235, 0.2)',
                  color: '#93c5fd',
                  border: '1px solid rgba(37, 99, 235, 0.4)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Loader2 size={10} className="animate-spin" />
                  Reading...
                </span>
              ) : isVisionEngine ? (
                <span style={{
                  fontSize: '10px',
                  background: 'rgba(249, 115, 22, 0.15)',
                  color: '#fb923c',
                  border: '1px solid rgba(249, 115, 22, 0.3)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontWeight: 600,
                  letterSpacing: '0.02em'
                }}>
                  {ocrEngine === 'cloudflare-workers-ai' ? 'Cloudflare Vision HTR' : 'Vision HTR'}
                </span>
              ) : (
                <span style={{
                  fontSize: '10px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-dim)',
                  border: '1px solid var(--border-subtle)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontWeight: 600
                }}>
                  Fast Local OCR
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={handleTranscribeVision}
                disabled={transcribing || isProcessingOcr}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: 'rgba(37, 99, 235, 0.2)',
                  color: '#93c5fd',
                  border: '1px solid rgba(37, 99, 235, 0.4)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  cursor: (transcribing || isProcessingOcr) ? 'not-allowed' : 'pointer',
                  opacity: (transcribing || isProcessingOcr) ? 0.7 : 1
                }}
                title="Deep scan using Cloudflare Workers AI for handwriting, formulas & whiteboards"
              >
                {transcribing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                <span>{transcribing ? 'Transcribing...' : 'Scan Handwriting'}</span>
              </button>

              <button
                onClick={handleAutoTag}
                disabled={autoTagging}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  cursor: autoTagging ? 'not-allowed' : 'pointer',
                  opacity: autoTagging ? 0.7 : 1
                }}
                title="Use AI to auto-tag, improve title, and file into best folder"
              >
                {autoTagging ? <Loader2 size={12} className="animate-spin" /> : <Tag size={12} />}
                <span>{autoTagging ? 'Tagging...' : 'AI Auto-Tag'}</span>
              </button>

              {currentItem.ocrText && (
                <button onClick={copyOcr} style={{ display: 'inline-flex', gap: '5px', alignItems: 'center', border: 0, background: 'transparent', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
          </div>

          {transcribeError && (
            <p style={{ color: '#ef4444', fontSize: '11px', margin: '4px 0 6px' }}>
              {transcribeError}
            </p>
          )}

          {currentItem.ocrText ? (
            <div style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: '110px', overflowY: 'auto', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              <ClickableText text={currentItem.ocrText} />
            </div>
          ) : isProcessingOcr ? (
            <p style={{ margin: '4px 0', fontSize: '11px', color: '#93c5fd' }}>
              Transcribing handwritten notes and text with AI... Results will appear here shortly.
            </p>
          ) : (
            <p style={{ margin: '4px 0', fontSize: '11px', color: 'var(--text-dim)' }}>
              No text detected by local OCR. Click <strong>Scan Handwriting</strong> for deep AI transcription.
            </p>
          )}

          {currentItem.metadata?.aiSummary && (
            <div style={{ marginTop: '8px', padding: '6px 10px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '6px', borderLeft: '3px solid #60a5fa', fontSize: '11px', color: '#cbd5e1' }}>
              <strong style={{ color: '#93c5fd' }}>AI Summary:</strong> {currentItem.metadata.aiSummary}
            </div>
          )}

          {currentItem.tags && currentItem.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Tags:</span>
              {currentItem.tags.map((tag, idx) => (
                <span key={idx} style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  background: 'rgba(37, 99, 235, 0.12)',
                  color: '#93c5fd',
                  border: '1px solid rgba(37, 99, 235, 0.3)',
                  padding: '1px 7px',
                  borderRadius: '12px'
                }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
