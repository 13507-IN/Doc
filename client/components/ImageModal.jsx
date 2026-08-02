'use client';
import React from 'react';
import { X, ExternalLink, Download } from 'lucide-react';

export default function ImageModal({ item, onClose }) {
  if (!item) return null;
  const imageSrc = item.previewUrl || item.url || item.content;

  return (
    <div style={{
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
      <div style={{
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
      </div>
    </div>
  );
}
