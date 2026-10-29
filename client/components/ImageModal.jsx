'use client';
import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Copy, Check, Globe } from 'lucide-react';
import ClickableText from './ClickableText';
import { extractUrlsFromText, getWebsiteUrlForItem, ensureAbsoluteUrl } from '../utils/urlHelper';

export default function ImageModal({ item, onClose }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!item) return null;
  const imageSrc = item.previewUrl || item.url || item.content;

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
            <a href={imageSrc} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)' }} title="Open Original Image">
              <ExternalLink size={18} />
            </a>
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
          src={imageSrc} 
          alt={item.title} 
          style={{
            maxWidth: '100%',
            maxHeight: detectedUrls.length > 0 ? '55vh' : '65vh',
            borderRadius: '12px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            objectFit: 'contain'
          }}
        />

        {/* OCR Extracted Text with Clickable Links */}
        {item.ocrText && (
          <div className="glass-panel" style={{ width: '100%', padding: '12px 14px', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '6px' }}>
              <strong style={{ fontSize: '12px', color: '#fff' }}>Extracted Text from Screenshot</strong>
              <button onClick={copyOcr} style={{ display: 'inline-flex', gap: '5px', alignItems: 'center', border: 0, background: 'transparent', color: 'var(--accent-primary)', cursor: 'pointer' }}>
                {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: '110px', overflowY: 'auto', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              <ClickableText text={item.ocrText} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
