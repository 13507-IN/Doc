'use client';
import React from 'react';
import { 
  Folder, Plus, Sparkles, Layers, 
  Tv, Image as ImageIcon, Link as LinkIcon, FileText, Bookmark, Star, Lock, LogOut
} from 'lucide-react';

export default function Sidebar({ 
  folders = [], 
  activeFolder, 
  onSelectFolder, 
  activeType, 
  onSelectType,
  activeTab, 
  onSelectTab,
  onOpenAddFolder,
  onOpenAssistant,
  uncategorizedCount = 0,
  user,
  onLogout
}) {
  return (
    <aside style={{
      width: '270px',
      minWidth: '270px',
      height: '100vh',
      position: 'sticky',
      top: 0,
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid var(--border-color)',
      padding: '20px 14px',
      gap: '18px',
      background: 'var(--bg-secondary)',
      zIndex: 40
    }}>
      {/* Brand Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)'
          }}>
            <Sparkles size={18} />
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
              HOLDER
            </h1>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Personal Assistant Vault</p>
          </div>
        </div>
      </div>

      {/* AI Assistant Button */}
      <button 
        onClick={onOpenAssistant}
        style={{
          width: '100%',
          padding: '11px 14px',
          borderRadius: '10px',
          background: 'rgba(37, 99, 235, 0.1)',
          border: '1px solid rgba(37, 99, 235, 0.35)',
          color: '#60a5fa',
          fontWeight: 600,
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(37, 99, 235, 0.2)';
          e.currentTarget.style.borderColor = 'var(--accent-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(37, 99, 235, 0.1)';
          e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.35)';
        }}
      >
        <Sparkles size={16} color="#3b82f6" />
        <span>Ask Personal Assistant</span>
      </button>

      {/* Quick Nav / Views */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '0 8px 4px' }}>
          Overview
        </p>

        <SidebarNavItem 
          active={activeTab === 'all' && activeFolder === 'all'} 
          onClick={() => { onSelectTab('all'); onSelectFolder('all'); }}
          icon={<Layers size={16} />}
          label="All Vault Items"
        />

        <SidebarNavItem 
          active={activeTab === 'favorites'} 
          onClick={() => onSelectTab('favorites')}
          icon={<Star size={16} color="#d97706" />}
          label="Favorites"
        />
      </div>

      {/* Folders Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 4px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Folders
          </p>
          <button 
            onClick={onOpenAddFolder}
            title="Create New Folder"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '2px',
              transition: 'transform 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Plus size={16} />
          </button>
        </div>

        <SidebarNavItem 
          active={activeFolder === 'all'} 
          onClick={() => onSelectFolder('all')}
          icon={<Folder size={16} color="#2563eb" />}
          label="All Folders"
        />

        {folders.map((folder) => (
          <SidebarNavItem 
            key={folder._id}
            active={activeFolder === folder._id}
            onClick={() => onSelectFolder(folder._id)}
            icon={<span style={{ fontSize: '14px' }}>{folder.icon || '📁'}</span>}
            label={folder.name}
            count={folder.itemCount}
            isPrivate={folder.isPrivate}
            color={folder.color}
          />
        ))}

        <SidebarNavItem 
          active={activeFolder === 'uncategorized'} 
          onClick={() => onSelectFolder('uncategorized')}
          icon={<Bookmark size={16} color="#94a3b8" />}
          label="Uncategorized"
          count={uncategorizedCount}
        />
      </div>

      {/* Item Types Filter */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '0 6px 4px' }}>
          Item Types
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
          <TypeFilterBtn active={activeType === 'all'} onClick={() => onSelectType('all')} label="All" />
          <TypeFilterBtn active={activeType === 'youtube'} onClick={() => onSelectType('youtube')} icon={<Tv size={13} color="#dc2626" />} label="YouTube" />
          <TypeFilterBtn active={activeType === 'image'} onClick={() => onSelectType('image')} icon={<ImageIcon size={13} color="#059669" />} label="Images" />
          <TypeFilterBtn active={activeType === 'link'} onClick={() => onSelectType('link')} icon={<LinkIcon size={13} color="#2563eb" />} label="Links" />
          <TypeFilterBtn active={activeType === 'note'} onClick={() => onSelectType('note')} icon={<FileText size={13} color="#d97706" />} label="Notes" />
        </div>
      </div>

      {/* Logged In User Profile Footer */}
      {user && (
        <div style={{
          borderTop: '1px solid var(--border-color)',
          paddingTop: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              fontSize: '13px'
            }}>
              {user.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user.name}
              </p>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user.email}
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Log Out"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              transition: 'color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <LogOut size={16} />
          </button>
        </div>
      )}
    </aside>
  );
}

function SidebarNavItem({ active, onClick, icon, label, count, isPrivate, color }) {
  return (
    <button 
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '8px 10px',
        borderRadius: '8px',
        background: active ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
        borderLeft: active ? '3px solid var(--accent-primary)' : '3px solid transparent',
        color: active ? '#fff' : 'var(--text-muted)',
        fontSize: '13px',
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--bg-primary)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', color: active ? 'var(--accent-primary)' : (color || 'inherit') }}>
          {icon}
        </div>
        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        {isPrivate && <Lock size={12} color="#059669" title="Private Folder" />}
      </div>
      {count !== undefined && (
        <span style={{ 
          fontSize: '11px', 
          background: active ? 'rgba(37, 99, 235, 0.3)' : 'var(--bg-primary)', 
          padding: '2px 7px', 
          borderRadius: '10px',
          color: active ? '#fff' : 'var(--text-dim)',
          fontWeight: 600
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

function TypeFilterBtn({ active, onClick, icon, label }) {
  return (
    <button 
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '6px 8px',
        borderRadius: '6px',
        background: active ? 'var(--accent-primary)' : 'var(--bg-primary)',
        border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
        color: active ? '#fff' : 'var(--text-muted)',
        fontSize: '11px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s ease'
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
