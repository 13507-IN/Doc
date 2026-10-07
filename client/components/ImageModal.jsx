'use client';
import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Copy, Check } from 'lucide-react';

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
        gap: '12px'
      }}>
        {/* Header toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', color: '#fff' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 600 }}>{item.title}</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <a href={imageSrc} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-muted)' }} title="Open Original">
              <ExternalLink size={18} />
            </a>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Image Display */}
        {/* Dynamic user-provided URLs cannot be safely whitelisted for next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc} 
          alt={item.title} 
          style={{
            maxWidth: '100%',
            maxHeight: '80vh',
            borderRadius: '12px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            objectFit: 'contain'
          }}
        />
        {item.ocrText && (
          <div className="glass-panel" style={{ width: '100%', maxWidth: '760px', padding: '12px', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '6px' }}>
              <strong style={{ fontSize: '12px', color: '#fff' }}>Extracted text</strong>
              <button onClick={copyOcr} style={{ display: 'inline-flex', gap: '5px', alignItems: 'center', border: 0, background: 'transparent', color: 'var(--accent-primary)', cursor: 'pointer' }}>
                {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: '130px', overflowY: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>{item.ocrText}</p>
          </div>
        )}
      </div>
    </div>
  );
}
