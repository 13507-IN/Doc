'use client';

import React from 'react';
import { Layers, Folder, Plus, Sparkles, Star } from 'lucide-react';

export default function MobileBottomNav({
  activeTab,
  onSelectTab,
  onOpenFolders,
  onOpenAddItem,
  onToggleAssistant
}) {
  return (
    <nav className="mobile-bottom-nav">
      <button 
        type="button"
        onClick={() => onSelectTab('all')}
        className={`bottom-nav-item ${activeTab === 'all' ? 'active' : ''}`}
      >
        <Layers size={19} />
        <span>Vault</span>
      </button>

      <button 
        type="button"
        onClick={onOpenFolders}
        className="bottom-nav-item"
      >
        <Folder size={19} />
        <span>Folders</span>
      </button>

      <button 
        type="button"
        onClick={onOpenAddItem}
        className="bottom-nav-item bottom-nav-add-btn"
        aria-label="Add Item to Vault"
      >
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          background: 'var(--accent-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(37, 99, 235, 0.5)'
        }}>
          <Plus size={22} color="#fff" />
        </div>
      </button>

      <button 
        type="button"
        onClick={onToggleAssistant}
        className="bottom-nav-item"
      >
        <Sparkles size={19} color="#60a5fa" />
        <span>AI Vault</span>
      </button>

      <button 
        type="button"
        onClick={() => onSelectTab('favorites')}
        className={`bottom-nav-item ${activeTab === 'favorites' ? 'active' : ''}`}
      >
        <Star size={19} color={activeTab === 'favorites' ? '#d97706' : 'currentColor'} />
        <span>Starred</span>
      </button>
    </nav>
  );
}
