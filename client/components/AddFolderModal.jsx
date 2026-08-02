'use client';
import React, { useState } from 'react';
import { X, Lock, Folder } from 'lucide-react';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const EMOJI_OPTIONS = ['💼', '🔒', '🎥', '🌐', '🚀', '💡', '🎨', '📚', '⚡', '💻', '🔑', '🎯'];
const COLOR_OPTIONS = ['#6366f1', '#ec4899', '#ef4444', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];

export default function AddFolderModal({ isOpen, onClose, onFolderCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('💼');
  const [color, setColor] = useState('#6366f1');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) return;

    try {
      setSubmitting(true);
      const res = await axios.post(`${API_BASE}/folders`, {
        name,
        description,
        icon,
        color,
        isPrivate
      });

      if (res.data.success) {
        onFolderCreated(res.data.folder);
        setName('');
        setDescription('');
        onClose();
      }
    } catch (err) {
      console.error('Error creating folder:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '460px',
        borderRadius: '20px',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', fontWeight: 700, color: '#fff' }}>
            Create New Folder
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
              Folder Icon
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: icon === emoji ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                    border: icon === emoji ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    fontSize: '18px',
                    cursor: 'pointer'
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
              Color Badge
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: c,
                    border: color === c ? '2px solid #fff' : 'none',
                    cursor: 'pointer',
                    transform: color === c ? 'scale(1.15)' : 'scale(1)'
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
              Folder Name *
            </label>
            <input 
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Brand Assets, Private Vault, Video Ideas"
              className="glass-input"
              style={{ width: '100%' }}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
              Description
            </label>
            <input 
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of what goes inside this folder..."
              className="glass-input"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input 
              type="checkbox"
              id="folderPrivate"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              style={{ accentColor: 'var(--accent-pink)', cursor: 'pointer' }}
            />
            <label htmlFor="folderPrivate" style={{ fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={14} color="#ec4899" />
              <span>Mark as Private / Important Folder</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: '10px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} style={{ padding: '10px 24px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--accent-primary) 0%, #4f46e5 100%)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
              {submitting ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
