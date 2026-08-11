'use client';
import React from 'react';
import { Search, Plus, Sparkles, RefreshCw } from 'lucide-react';

export default function Navbar({ 
  searchQuery, 
  onSearchChange, 
  onOpenAddItem, 
  onToggleAssistant,
  activeFolderName,
  totalItems = 0,
  onRefresh
}) {
  return (
    <header style={{
      height: '66px',
      padding: '0 28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid var(--border-color)',
      background: 'var(--bg-secondary)',
      position: 'sticky',
      top: 0,
      zIndex: 30
    }}>
      {/* Current Context / Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: '#fff' }}>
          {activeFolderName || 'All Vault Items'}
        </h2>
        <span style={{
          background: 'var(--bg-primary)',
          color: '#93c5fd',
          border: '1px solid var(--border-color)',
          padding: '2px 9px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 600
        }}>
          {totalItems} items
        </span>
        <button
          onClick={onRefresh}
          title="Refresh Data"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            borderRadius: '6px',
            transition: 'color 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Search Input Bar */}
      <div style={{ position: 'relative', width: '380px' }}>
        <Search 
          size={16} 
          color="var(--text-muted)" 
          style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} 
        />
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search YouTube videos, links, notes, images, tags..."
          className="glass-input"
          style={{
            width: '100%',
            paddingLeft: '40px',
            paddingRight: '36px',
            fontSize: '13px',
            height: '38px'
          }}
        />
        {searchQuery ? (
          <button 
            onClick={() => onSearchChange('')}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            ✕
          </button>
        ) : (
          <span style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '10px',
            color: 'var(--text-dim)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            padding: '1px 5px',
            background: 'var(--bg-secondary)',
            fontFamily: 'monospace'
          }}>
            ⌘K
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button 
          onClick={onOpenAddItem}
          style={{
            padding: '9px 16px',
            borderRadius: '8px',
            background: 'var(--accent-primary)',
            color: '#fff',
            border: 'none',
            fontWeight: 600,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#1d4ed8';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--accent-primary)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <Plus size={16} />
          <span>Save Item</span>
        </button>

        <button 
          onClick={onToggleAssistant}
          style={{
            padding: '9px 14px',
            borderRadius: '8px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            color: '#60a5fa',
            fontWeight: 600,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }}
        >
          <Sparkles size={15} color="#3b82f6" />
          <span>AI Assistant</span>
        </button>
      </div>
    </header>
  );
}
