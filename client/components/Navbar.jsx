'use client';
import React from 'react';
import { Search, Plus, Sparkles, RefreshCw, Menu, Download, X } from 'lucide-react';

export default function Navbar({ 
  searchQuery, 
  onSearchChange, 
  onOpenAddItem, 
  onToggleAssistant,
  activeFolderName,
  totalItems = 0,
  onRefresh,
  onToggleMobileMenu,
  onOpenInstall,
  isAppInstalled = false
}) {
  return (
    <header className="navbar-header">
      {/* Current Context / Title */}
      <div className="navbar-context">
        {onToggleMobileMenu && (
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={onToggleMobileMenu}
            aria-label="Open Folders and Navigation Menu"
          >
            <Menu size={20} />
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, overflow: 'hidden' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {activeFolderName || 'All Vault Items'}
          </h2>
          <span className="navbar-item-count-badge">
            {totalItems}
          </span>
          <button
            onClick={onRefresh}
            title="Refresh Data"
            className="navbar-refresh-btn"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="navbar-search-wrapper">
        <Search 
          size={16} 
          color="var(--text-muted)" 
          style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} 
        />
        <input 
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search videos, PDFs, images, notes..."
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
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px'
            }}
            title="Clear search"
          >
            <X size={14} />
          </button>
        ) : (
          <span className="navbar-cmd-k">
            ⌘K
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="navbar-actions">
        {!isAppInstalled && onOpenInstall && (
          <button 
            onClick={onOpenInstall}
            className="navbar-btn-install"
            title="Install Holder App"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 11px',
              borderRadius: '8px',
              background: 'rgba(37, 99, 235, 0.15)',
              border: '1px solid rgba(37, 99, 235, 0.35)',
              color: '#93c5fd',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Download size={14} color="#60a5fa" />
            <span className="navbar-btn-label">Install App</span>
          </button>
        )}

        <button 
          onClick={onOpenAddItem}
          className="navbar-btn-primary"
          title="Save Item"
        >
          <Plus size={16} />
          <span className="navbar-btn-label">Save Item</span>
        </button>

        <button 
          onClick={onToggleAssistant}
          className="navbar-btn-assistant"
          title="AI Assistant"
        >
          <Sparkles size={15} color="#3b82f6" />
          <span className="navbar-btn-label">AI Assistant</span>
        </button>
      </div>
    </header>
  );
}
