'use client';
import React from 'react';
import { X, ExternalLink, Download, FileText } from 'lucide-react';

export default function PdfModal({ item, onClose }) {
  if (!item) return null;

  const pdfUrl = item.url || item.previewUrl;
  const fileName = item.metadata?.filename || (item.url ? item.url.split('/').pop().split('?')[0] : 'document.pdf');
  const fileSize = item.metadata?.size
    ? item.metadata.size > 1024 * 1024
      ? (item.metadata.size / (1024 * 1024)).toFixed(1) + ' MB'
      : Math.round(item.metadata.size / 1024) + ' KB'
    : null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 110,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '980px',
        maxHeight: '92vh',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--border-color)',
        background: 'rgba(15, 18, 32, 0.96)'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: 'rgba(18, 21, 38, 0.9)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'rgba(225, 29, 72, 0.15)',
              border: '1px solid rgba(225, 29, 72, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fda4af',
              flexShrink: 0
            }}>
              <FileText size={18} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <h3 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '16px',
                fontWeight: 700,
                color: '#fff',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden'
              }}>
                {item.title}
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {fileName} {fileSize ? '• ' + fileSize : ''}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {pdfUrl && (
              <>
                <a
                  href={pdfUrl}
                  download={fileName}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid var(--border-color)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    cursor: 'pointer'
                  }}
                  title="Download PDF"
                >
                  <Download size={14} />
                  <span>Download</span>
                </a>

                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: 'rgba(225, 29, 72, 0.15)',
                    border: '1px solid rgba(225, 29, 72, 0.3)',
                    color: '#fda4af',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    cursor: 'pointer'
                  }}
                  title="Open in new window"
                >
                  <span>Open tab</span>
                  <ExternalLink size={14} />
                </a>
              </>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* PDF Viewer Body */}
        <div style={{ position: 'relative', width: '100%', height: '68vh', backgroundColor: '#090b14' }}>
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              title={item.title}
              style={{
                width: '100%',
                height: '100%',
                border: 'none'
              }}
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              color: 'var(--text-muted)'
            }}>
              <FileText size={40} color="#f43f5e" />
              <p style={{ fontSize: '14px' }}>No valid PDF URL available.</p>
            </div>
          )}
        </div>

        {/* Footer Notes (if present) */}
        {item.content && (
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color)',
            background: 'rgba(10, 12, 22, 0.7)',
            maxHeight: '120px',
            overflowY: 'auto'
          }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Notes & Summary
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
              {item.content}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}