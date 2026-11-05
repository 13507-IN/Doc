'use client';
import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Copy, Check, Globe, Sparkles, Loader2 } from 'lucide-react';
import ClickableText from './ClickableText';
import { extractUrlsFromText, getWebsiteUrlForItem, ensureAbsoluteUrl } from '../utils/urlHelper';
import usePrivateMediaUrl from '../utils/usePrivateMediaUrl';

export default function ImageModal({ item, onClose, onItemUpdated, token }) {
  const [copied, setCopied] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState('');
  const imageSrc = usePrivateMediaUrl(
    item?.mediaUrl || item?.previewUrl || item?.url || item?.content
  );

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  // Extract all detected website URLs from the screenshot
  const primaryWebsiteUrl = getWebsiteUrlForItem(item);
  const allOcrUrls = extractUrlsFromText(item.ocrText);
  const detectedUrls = Array.from(new Set([
    ...(primaryWebsiteUrl ? [primaryWebsiteUrl] : []),
    ...(item.metadata?.detectedUrls || []),
    ...allOcrUrls
  ].map(ensureAbsoluteUrl)));

  const copyOcr = async () => {
    await navigator.clipboard.writeText(item.ocrText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleTranscribeVision = async () => {
    if (transcribing || !item?._id) return;
    setTranscribing(true);
    setTranscribeError('');
    try {
      const activeToken = token || localStorage.getItem('token');
      const res = await fetch(`/api/items/${item._id}/transcribe-vision`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeToken}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Vision transcription failed');
      }
      if (onItemUpdated && data.item) {
        onItemUpdated(data.item);
      }
    } catch (err) {
      setTranscribeError(err.message || 'Failed to transcribe handwriting');
    } finally {
      setTranscribing(false);
    }
  };

  const ocrEngine = item.metadata?.ocrEngine;
  const isVisionEngine = ocrEngine === 'cloudflare-workers-ai' || ocrEngine === 'gemini-vision';

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
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 600 }}>{item.title}</h3>
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
          alt={item.title} 
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
            {item.mediaUrl ? 'Loading private image…' : 'Image unavailable.'}
          </p>
        )}

        {/* OCR / Vision HTR Extracted Text */}
        <div className="glass-panel" style={{ width: '100%', padding: '12px 14px', borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '12px', color: '#fff' }}>Extracted Text</strong>
              {isVisionEngine ? (
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
                disabled={transcribing}
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
                  cursor: transcribing ? 'not-allowed' : 'pointer',
                  opacity: transcribing ? 0.7 : 1
                }}
                title="Deep scan using Cloudflare Workers AI for handwriting, formulas & whiteboards"
              >
                {transcribing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                <span>{transcribing ? 'Transcribing...' : 'Scan Handwriting'}</span>
              </button>

              {item.ocrText && (
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

          {item.ocrText ? (
            <div style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: '110px', overflowY: 'auto', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              <ClickableText text={item.ocrText} />
            </div>
          ) : (
            <p style={{ margin: '4px 0', fontSize: '11px', color: 'var(--text-dim)' }}>
              No text detected by local OCR. Click <strong>Scan Handwriting</strong> for deep AI transcription.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
