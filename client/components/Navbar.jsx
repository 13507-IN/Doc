'use client';
import React from 'react';
import { Search, Plus, Sparkles, Folder, Filter, RefreshCw } from 'lucide-react';

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
      height: '70px',
      padding: '0 28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid var(--border-color)',
      background: 'rgba(10, 12, 20, 0.8)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 30
    }}>
      {/* Current Context / Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', fontWeight: 700, color: '#fff' }}>
          {activeFolderName || 'All Vault Items'}
        </h2>
        <span style={{
          background: 'rgba(99, 102, 241, 0.15)',
          color: '#a5b4fc',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          padding: '2px 10px',
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
            alignItems: 'center'
          }}
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
            fontSize: '13px',
            height: '40px'
          }}
        />
        {searchQuery && (
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
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button 
          onClick={onOpenAddItem}
          style={{
            padding: '10px 18px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--accent-primary) 0%, #4f46e5 100%)',
            color: '#fff',
            border: 'none',
            fontWeight: 600,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          <Plus size={16} />
          <span>Save Item</span>
        </button>

        <button 
          onClick={onToggleAssistant}
          style={{
            padding: '9px 14px',
            borderRadius: '10px',
            background: 'rgba(236, 72, 153, 0.15)',
            border: '1px solid rgba(236, 72, 153, 0.4)',
            color: '#f472b6',
            fontWeight: 600,
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer'
          }}
        >
          <Sparkles size={16} />
          <span>AI Assistant</span>
        </button>
      </div>
    </header>
  );
}
