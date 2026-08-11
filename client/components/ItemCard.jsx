'use client';
import React, { useState } from 'react';
import { 
  Play, ExternalLink, Copy, Check, Star, Pin, Trash2, 
  Tv, Image as ImageIcon, Link as LinkIcon, FileText
} from 'lucide-react';

export default function ItemCard({ 
  item, 
  onPlayYouTube, 
  onViewImage, 
  onToggleFavorite, 
  onTogglePin, 
  onDeleteItem 
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getBadgeClass = (type) => {
    switch (type) {
      case 'youtube': return 'type-youtube';
      case 'image': return 'type-image';
      case 'link': return 'type-link';
      case 'note': return 'type-note';
      default: return 'type-link';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'youtube': return <Tv size={12} />;
      case 'image': return <ImageIcon size={12} />;
      case 'link': return <LinkIcon size={12} />;
      case 'note': return <FileText size={12} />;
      default: return <LinkIcon size={12} />;
    }
  };

  return (
    <div className="glass-card" style={{
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
      border: item.pinned ? '1px solid var(--accent-amber)' : undefined
    }}>
      {/* Top Banner / Preview Thumbnail */}
      {item.type === 'youtube' && (
        <div 
          className="card-media-wrapper"
          onClick={() => onPlayYouTube(item)}
          style={{
            height: '160px',
            width: '100%',
            backgroundColor: '#0b0f19',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div 
            className="card-media-img"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${item.previewUrl || `https://img.youtube.com/vi/${item.metadata?.youtubeId}/hqdefault.jpg`})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(11, 15, 25, 0.9) 0%, transparent 60%)'
          }} />
          <div style={{
            zIndex: 2,
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 16px rgba(220, 38, 38, 0.5)',
            transition: 'transform 0.2s ease'
          }}>
            <Play size={20} style={{ marginLeft: '2px' }} />
          </div>
          <span style={{
            position: 'absolute',
            bottom: '10px',
            left: '12px',
            zIndex: 2,
            fontSize: '11px',
            color: '#fff',
            fontWeight: 600,
            textShadow: '0 1px 3px rgba(0,0,0,0.8)'
          }}>
            {item.metadata?.authorName || 'YouTube Video'}
          </span>
        </div>
      )}

      {item.type === 'image' && (
        <div 
          className="card-media-wrapper"
          onClick={() => onViewImage(item)}
          style={{
            height: '170px',
            width: '100%',
            backgroundColor: '#0b0f19',
            cursor: 'pointer'
          }}
        >
          <div 
            className="card-media-img"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${item.previewUrl || item.url || item.content})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(11, 15, 25, 0.7) 0%, transparent 60%)'
          }} />
        </div>
      )}

      {item.type === 'link' && item.previewUrl && (
        <div className="card-media-wrapper" style={{ height: '120px', width: '100%', backgroundColor: '#0b0f19' }}>
          <div 
            className="card-media-img"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${item.previewUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
        </div>
      )}

      {/* Main Content Info */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
        {/* Header Tags & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className={`type-badge ${getBadgeClass(item.type)}`}>
              {getTypeIcon(item.type)}
              {item.type}
            </span>

            {item.folderId && (
              <span style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                color: item.folderId.color || '#93c5fd',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 600
              }}>
                <span>{item.folderId.icon || '📁'}</span>
                <span>{item.folderId.name}</span>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <button 
              onClick={() => onToggleFavorite(item._id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: item.isFavorite ? '#d97706' : 'var(--text-dim)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                transition: 'color 0.15s ease'
              }}
              title="Favorite"
            >
              <Star size={15} fill={item.isFavorite ? '#d97706' : 'transparent'} />
            </button>

            <button 
              onClick={() => onTogglePin(item._id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: item.pinned ? 'var(--accent-amber)' : 'var(--text-dim)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                transition: 'color 0.15s ease'
              }}
              title="Pin to top"
            >
              <Pin size={15} fill={item.pinned ? 'var(--accent-amber)' : 'transparent'} />
            </button>
          </div>
        </div>

        {/* Title */}
        <h3 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '15px',
          fontWeight: 700,
          color: '#fff',
          lineHeight: '1.4',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {item.title}
        </h3>

        {/* Content Preview for Notes or Links */}
        {item.type === 'note' && item.content && (
          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            padding: '10px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            fontFamily: 'monospace',
            maxHeight: '90px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap'
          }}>
            {item.content}
          </div>
        )}

        {item.type === 'link' && item.url && (
          <p style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            wordBreak: 'break-all',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {item.url}
          </p>
        )}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: 'auto' }}>
            {item.tags.map((tag, idx) => (
              <span key={idx} style={{
                fontSize: '10px',
                color: '#93c5fd',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                padding: '2px 7px',
                borderRadius: '6px',
                fontWeight: 600
              }}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '10px',
          marginTop: 'auto'
        }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {(item.url || item.content) && (
              <button 
                onClick={(e) => handleCopy(item.url || item.content, e)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: copied ? '#059669' : 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px'
                }}
                title="Copy URL or Content"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            )}

            {item.url && (
              <a 
                href={item.url} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  color: 'var(--accent-primary)',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Open Link"
              >
                <ExternalLink size={14} />
              </a>
            )}

            <button 
              onClick={() => onDeleteItem(item._id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                padding: '4px',
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
              title="Delete Item"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
