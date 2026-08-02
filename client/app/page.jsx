'use client';
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import ItemCard from '../components/ItemCard';
import AddItemModal from '../components/AddItemModal';
import AddFolderModal from '../components/AddFolderModal';
import AIAssistantDrawer from '../components/AIAssistantDrawer';
import YouTubeModal from '../components/YouTubeModal';
import ImageModal from '../components/ImageModal';
import { Plus, Sparkles, Folder, SearchX } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function Home() {
  const [items, setItems] = useState([]);
  const [folders, setFolders] = useState([]);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);

  const [activeFolder, setActiveFolder] = useState('all');
  const [activeType, setActiveType] = useState('all');
  const [activeTab, setActiveTab] = useState('all'); // all | favorites
  const [searchQuery, setSearchQuery] = useState('');

  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isAddFolderOpen, setIsAddFolderOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  const [activeYouTubeItem, setActiveYouTubeItem] = useState(null);
  const [activeImageItem, setActiveImageItem] = useState(null);

  const [loading, setLoading] = useState(true);

  // Fetch Folders
  const fetchFolders = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/folders`);
      if (res.data.success) {
        setFolders(res.data.folders);
        setUncategorizedCount(res.data.uncategorizedCount || 0);
      }
    } catch (err) {
      console.error('Error fetching folders:', err.message);
    }
  }, []);

  // Fetch Items
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (activeFolder !== 'all') params.folderId = activeFolder;
      if (activeType !== 'all') params.type = activeType;
      if (activeTab === 'favorites') params.isFavorite = 'true';
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await axios.get(`${API_BASE}/items`, { params });
      if (res.data.success) {
        setItems(res.data.items);
      }
    } catch (err) {
      console.error('Error fetching items:', err.message);
    } finally {
      setLoading(false);
    }
  }, [activeFolder, activeType, activeTab, searchQuery]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleToggleFavorite = async (id) => {
    try {
      const res = await axios.patch(`${API_BASE}/items/${id}/favorite`);
      if (res.data.success) {
        fetchItems();
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  const handleTogglePin = async (id) => {
    try {
      const res = await axios.patch(`${API_BASE}/items/${id}/pin`);
      if (res.data.success) {
        fetchItems();
      }
    } catch (err) {
      console.error('Error toggling pin:', err);
    }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item from your vault?')) return;
    try {
      const res = await axios.delete(`${API_BASE}/items/${id}`);
      if (res.data.success) {
        fetchItems();
        fetchFolders();
      }
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  const activeFolderObj = folders.find(f => f._id === activeFolder);
  const activeFolderName = activeFolder === 'all' 
    ? 'All Vault Items' 
    : activeFolder === 'uncategorized' 
      ? 'Uncategorized Items' 
      : activeFolderObj ? `${activeFolderObj.icon || '📁'} ${activeFolderObj.name}` : 'Folder Items';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
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
        />

        {/* Content Container */}
        <div style={{ padding: '28px', flex: 1, overflowY: 'auto' }}>
          
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
          {loading ? (
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
                {searchQuery ? `No results matching "${searchQuery}".` : 'Your vault is ready! Click below to save your first YouTube video, image, or link.'}
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
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
              gap: '20px'
            }}>
              {items.map((item) => (
                <ItemCard 
                  key={item._id}
                  item={item}
                  onPlayYouTube={(item) => setActiveYouTubeItem(item)}
                  onViewImage={(item) => setActiveImageItem(item)}
                  onToggleFavorite={handleToggleFavorite}
                  onTogglePin={handleTogglePin}
                  onDeleteItem={handleDeleteItem}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modals & Slide-over Assistant Drawer */}
      <AddItemModal 
        isOpen={isAddItemOpen}
        onClose={() => setIsAddItemOpen(false)}
        folders={folders}
        defaultFolderId={activeFolder}
        onItemAdded={() => { fetchItems(); fetchFolders(); }}
      />

      <AddFolderModal 
        isOpen={isAddFolderOpen}
        onClose={() => setIsAddFolderOpen(false)}
        onFolderCreated={() => fetchFolders()}
      />

      <AIAssistantDrawer 
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onSelectFolder={(fId) => setActiveFolder(fId)}
      />

      <YouTubeModal 
        item={activeYouTubeItem}
        onClose={() => setActiveYouTubeItem(null)}
      />

      <ImageModal 
        item={activeImageItem}
        onClose={() => setActiveImageItem(null)}
      />
    </div>
  );
}
