'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import ItemCard from '../components/ItemCard';
import AddItemModal from '../components/AddItemModal';
import AddFolderModal from '../components/AddFolderModal';
import AIAssistantDrawer from '../components/AIAssistantDrawer';
import AuthModal from '../components/AuthModal';
import YouTubeModal from '../components/YouTubeModal';
import ImageModal from '../components/ImageModal';
import PdfModal from '../components/PdfModal';
import CommandPalette from '../components/CommandPalette';
import MobileBottomNav from '../components/MobileBottomNav';
import InstallAppModal from '../components/InstallAppModal';
import { Plus, SearchX } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function Home() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const [items, setItems] = useState([]);
  const [folders, setFolders] = useState([]);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);

  const [activeFolder, setActiveFolder] = useState('all');
  const [activeType, setActiveType] = useState('all');
  const [activeTab, setActiveTab] = useState('all'); // all | favorites
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [prefillUrl, setPrefillUrl] = useState('');
  const [copiedUrl, setCopiedUrl] = useState('');
  const [dismissedCopiedUrl, setDismissedCopiedUrl] = useState('');
  const [isAddFolderOpen, setIsAddFolderOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  const [activeYouTubeItem, setActiveYouTubeItem] = useState(null);
  const [activeImageItem, setActiveImageItem] = useState(null);
  const [activePdfItem, setActivePdfItem] = useState(null);

  const [loading, setLoading] = useState(true);
  const requestControllerRef = useRef(null);

  // Handle PWA installation and Service Worker registration
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if running in standalone mode (already installed PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      setIsAppInstalled(true);
    }

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
      setIsInstallModalOpen(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Initialize Auth on mount
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedToken = localStorage.getItem('holder_token');
      const savedUser = localStorage.getItem('holder_user');

      if (savedToken && savedUser) {
        setToken(savedToken);
        try {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          window.postMessage({ type: 'HOLDER_AUTH_TOKEN', token: savedToken, user: parsedUser }, '*');

          // If coming from Google OAuth callback redirect, show install popup
          const justLoggedIn = sessionStorage.getItem('holder_just_logged_in');
          if (justLoggedIn) {
            sessionStorage.removeItem('holder_just_logged_in');
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
            if (!isStandalone) {
              setTimeout(() => {
                setIsInstallModalOpen(true);
              }, 600);
            }
          }
        } catch (e) {
          localStorage.removeItem('holder_token');
          localStorage.removeItem('holder_user');
          setIsAuthOpen(true);
        }
      } else {
        setIsAuthOpen(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleLoginSuccess = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('holder_token', newToken);
    localStorage.setItem('holder_user', JSON.stringify(newUser));
    if (typeof window !== 'undefined') {
      window.postMessage({ type: 'HOLDER_AUTH_TOKEN', token: newToken, user: newUser }, '*');
    }
    setIsAuthOpen(false);

    // Pop up install app modal right after sign up or log in
    if (typeof window !== 'undefined') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      if (!isStandalone) {
        setTimeout(() => {
          setIsInstallModalOpen(true);
        }, 500);
      }
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('holder_token');
    localStorage.removeItem('holder_user');
    if (typeof window !== 'undefined') {
      window.postMessage({ type: 'HOLDER_AUTH_TOKEN', token: null, user: null }, '*');
    }
    setItems([]);
    setFolders([]);
    setIsAuthOpen(true);
  };

  // Clipboard auto-detection: check for copied URL when window is focused
  useEffect(() => {
    if (!token) return;

    const checkClipboard = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
          const clipText = await navigator.clipboard.readText();
          if (clipText && (clipText.startsWith('http://') || clipText.startsWith('https://'))) {
            const clean = clipText.trim();
            if (clean !== dismissedCopiedUrl && clean !== copiedUrl) {
              const alreadyPresent = items.some(item => item.url === clean);
              if (!alreadyPresent) {
                setCopiedUrl(clean);
              }
            }
          }
        }
      } catch (e) {
        // Permission dismissed or not granted; fail silently
      }
    };

    window.addEventListener('focus', checkClipboard);
    return () => window.removeEventListener('focus', checkClipboard);
  }, [token, items, dismissedCopiedUrl, copiedUrl]);

  // Fetch Folders
  const fetchFolders = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE}/folders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.data.success) {
        setFolders(res.data.folders);
        setUncategorizedCount(res.data.uncategorizedCount || 0);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        handleLogout();
      }
    }
  }, [token]);

  // Fetch Items
  const fetchItems = useCallback(async ({ append = false, cursor = null } = {}) => {
    if (!token) return;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    try {
      setLoading(true);
      const params = { limit: 30 };
      if (activeFolder !== 'all') params.folderId = activeFolder;
      if (activeType !== 'all') params.type = activeType;
      if (activeTab === 'favorites') params.isFavorite = 'true';
      if (appliedSearchQuery.trim()) params.search = appliedSearchQuery.trim();
      if (cursor) params.cursor = cursor;

      const res = await axios.get(`${API_BASE}/items`, {
        params,
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal
      });
      if (res.data.success) {
        setItems((current) => append ? [...current, ...res.data.items] : res.data.items);
        setHasMore(Boolean(res.data.page?.hasMore));
        setNextCursor(res.data.page?.nextCursor || null);
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      if (err.response?.status === 401) {
        handleLogout();
      }
    } finally {
      if (requestControllerRef.current === controller) setLoading(false);
    }
  }, [token, activeFolder, activeType, activeTab, appliedSearchQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => setAppliedSearchQuery(searchQuery), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => () => requestControllerRef.current?.abort(), []);

  // A screenshot appears immediately; refresh only while OCR is still running.
  useEffect(() => {
    const hasPendingOcr = items.some((item) => ['pending', 'processing'].includes(item.ocrStatus));
    if (!hasPendingOcr) return undefined;
    const timer = window.setInterval(() => fetchItems(), 4500);
    return () => window.clearInterval(timer);
  }, [items, fetchItems]);

  useEffect(() => {
    const listener = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => { void fetchFolders(); }, 0);
    return () => window.clearTimeout(timer);
  }, [token, fetchFolders]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => { void fetchItems(); }, 0);
    return () => window.clearTimeout(timer);
  }, [token, fetchItems]);

  const handleToggleFavorite = async (id) => {
    try {
      const res = await axios.patch(`${API_BASE}/items/${id}/favorite`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.data.success) {
        setItems((current) => current
          .map((item) => item._id === id ? { ...item, isFavorite: res.data.item.isFavorite } : item)
          .filter((item) => activeTab !== 'favorites' || item.isFavorite));
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  const handleTogglePin = async (id) => {
    try {
      const res = await axios.patch(`${API_BASE}/items/${id}/pin`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.data.success) {
        setItems((current) => current
          .map((item) => item._id === id ? { ...item, pinned: res.data.item.pinned } : item)
          .sort((a, b) => Number(b.pinned) - Number(a.pinned)));
      }
    } catch (err) {
      console.error('Error toggling pin:', err);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item from your vault?')) return;
    try {
      const res = await axios.delete(`${API_BASE}/items/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.data.success) {
        fetchItems();
        fetchFolders();
      }
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setIsAddItemOpen(true);
  };

  const activeFolderObj = folders.find(f => f._id === activeFolder);
  const activeFolderName = activeFolder === 'all' 
    ? 'All Vault Items' 
    : activeFolder === 'uncategorized' 
      ? 'Uncategorized Items' 
      : activeFolderObj ? `${activeFolderObj.icon || '📁'} ${activeFolderObj.name}` : 'Folder Items';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Auth Modal */}
      <AuthModal 
        isOpen={isAuthOpen}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* PWA Install App Modal */}
      <InstallAppModal 
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        deferredPrompt={deferredPrompt}
        onInstalled={() => {
          setIsAppInstalled(true);
          setDeferredPrompt(null);
        }}
      />

      {/* Sidebar */}
      <Sidebar 
        folders={folders}
        activeFolder={activeFolder}
        onSelectFolder={(fId) => setActiveFolder(fId)}
        activeType={activeType}
        onSelectType={(type) => setActiveType(type)}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        onOpenAddFolder={() => setIsAddFolderOpen(true)}
        onOpenAssistant={() => setIsAssistantOpen(true)}
        uncategorizedCount={uncategorizedCount}
        user={user}
        onLogout={handleLogout}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenInstall={() => setIsInstallModalOpen(true)}
        isAppInstalled={isAppInstalled}
      />

      {/* Main Content Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Navbar */}
        <Navbar 
          searchQuery={searchQuery}
          onSearchChange={(q) => setSearchQuery(q)}
          onOpenAddItem={() => setIsAddItemOpen(true)}
          onToggleAssistant={() => setIsAssistantOpen(prev => !prev)}
          activeFolderName={activeFolderName}
          totalItems={items.length}
          onRefresh={() => { fetchItems(); fetchFolders(); }}
          onToggleMobileMenu={() => setIsMobileSidebarOpen(prev => !prev)}
          onOpenInstall={() => setIsInstallModalOpen(true)}
          isAppInstalled={isAppInstalled}
        />

        {/* Content Container */}
        <div className="main-content-padding" style={{ overflowY: 'auto' }}>
          
          {/* Active Folder Header Banner */}
          {activeFolderObj && (
            <div className="glass-panel animate-fade-in" style={{
              padding: '18px 24px',
              borderRadius: '16px',
              marginBottom: '24px',
              borderLeft: `4px solid ${activeFolderObj.color || '#6366f1'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{activeFolderObj.icon || '📁'}</span>
                  <span>{activeFolderObj.name}</span>
                  {activeFolderObj.isPrivate && <span style={{ fontSize: '12px', background: 'rgba(236,72,153,0.2)', color: '#f472b6', padding: '2px 8px', borderRadius: '10px' }}>Private</span>}
                </h3>
                {activeFolderObj.description && (
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {activeFolderObj.description}
                  </p>
                )}
              </div>

              <button
                onClick={() => setIsAddItemOpen(true)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '10px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  color: '#a5b4fc',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                + Add to Folder
              </button>
            </div>
          )}

          {/* Grid Layout */}
          {loading && items.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading your info vault...
            </div>
          ) : items.length === 0 ? (
            <div className="glass-panel" style={{
              padding: '60px 20px',
              borderRadius: '20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              maxWidth: '480px',
              margin: '40px auto'
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)'
              }}>
                <SearchX size={28} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: '#fff' }}>
                No Items Found
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                {searchQuery ? `No results matching "${searchQuery}".` : 'Your vault is ready! Click below to save your first YouTube video, PDF, image, or link.'}
              </p>
              <button 
                onClick={() => setIsAddItemOpen(true)}
                style={{
                  padding: '10px 20px',
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
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)'
                }}
              >
                <Plus size={16} />
                <span>Save New Item</span>
              </button>
            </div>
          ) : (
            <>
              <div className="items-grid">
                {items.map((item) => (
                  <ItemCard
                    key={item._id}
                    item={item}
                    onPlayYouTube={(item) => setActiveYouTubeItem(item)}
                    onViewImage={(item) => setActiveImageItem(item)}
                    onViewPdf={(item) => setActivePdfItem(item)}
                    onToggleFavorite={handleToggleFavorite}
                    onTogglePin={handleTogglePin}
                    onEditItem={handleEditItem}
                    onDeleteItem={handleDeleteItem}
                  />
                ))}
              </div>
              {hasMore && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 0 8px' }}>
                  <button
                    onClick={() => fetchItems({ append: true, cursor: nextCursor })}
                    disabled={loading}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-secondary)',
                      color: '#fff',
                      cursor: loading ? 'wait' : 'pointer'
                    }}
                  >
                    {loading ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Modals & Slide-over Assistant Drawer */}
      <AddItemModal 
        isOpen={isAddItemOpen}
        onClose={() => {
          setIsAddItemOpen(false);
          setEditingItem(null);
          setPrefillUrl('');
        }}
        folders={folders}
        defaultFolderId={activeFolder}
        editingItem={editingItem}
        prefillUrl={prefillUrl}
        onItemAdded={() => {
          fetchItems();
          fetchFolders();
          setEditingItem(null);
          setPrefillUrl('');
        }}
        token={token}
      />

      <AddFolderModal 
        isOpen={isAddFolderOpen}
        onClose={() => setIsAddFolderOpen(false)}
        onFolderCreated={() => fetchFolders()}
        token={token}
      />

      <AIAssistantDrawer 
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onSelectFolder={(fId) => setActiveFolder(fId)}
        token={token}
      />

      <YouTubeModal 
        item={activeYouTubeItem}
        onClose={() => setActiveYouTubeItem(null)}
      />

      <ImageModal 
        item={activeImageItem}
        onClose={() => setActiveImageItem(null)}
      />

      <PdfModal 
        item={activePdfItem}
        onClose={() => setActivePdfItem(null)}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        token={token}
        onEditItem={(item) => {
          setIsCommandPaletteOpen(false);
          handleEditItem(item);
        }}
      />

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav 
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'all') setActiveFolder('all');
        }}
        onOpenFolders={() => setIsMobileSidebarOpen(true)}
        onOpenAddItem={() => {
          setEditingItem(null);
          setPrefillUrl('');
          setIsAddItemOpen(true);
        }}
        onToggleAssistant={() => setIsAssistantOpen(prev => !prev)}
      />

      {/* Floating Copied Link Quick-Capture Pill */}
      {copiedUrl && (
        <div className="glass-panel animate-scale-in floating-clipboard-pill" style={{
          position: 'fixed',
          zIndex: 60,
          borderRadius: '14px',
          padding: '12px 16px',
          border: '1px solid var(--accent-primary)',
          background: 'rgba(15, 23, 42, 0.95)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          maxWidth: '440px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'rgba(37, 99, 235, 0.2)',
            color: '#60a5fa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: '15px'
          }}>
            📋
          </div>
          <div style={{ overflow: 'hidden', minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>
              Copied Link Detected
            </p>
            <p style={{ fontSize: '12px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {copiedUrl}
            </p>
          </div>
          <button
            onClick={() => {
              setPrefillUrl(copiedUrl);
              setCopiedUrl('');
              setIsAddItemOpen(true);
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Save to Vault
          </button>
          <button
            onClick={() => {
              setDismissedCopiedUrl(copiedUrl);
              setCopiedUrl('');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '2px'
            }}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
