'use client';
import React, { useState } from 'react';
import { X, Lock, Folder, Check } from 'lucide-react';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const COLOR_OPTIONS = ['#2563eb', '#3b82f6', '#059669', '#10b981', '#d97706', '#dc2626', '#e11d48', '#7c3aed', '#64748b'];

export default function AddFolderModal({ isOpen, onClose, onFolderCreated, token }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#2563eb');
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
        icon: '',
        color,
        isPrivate
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
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
      <div className="glass-panel animate-scale-in" style={{
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
          {/* Folder Color Palette */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>
              Folder Color
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: c,
                    border: color === c ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: color === c ? 'scale(1.1)' : 'scale(1)',
                    transition: 'transform 0.15s ease'
                  }}
                  title={c}
                >
                  {color === c && <Check size={16} color="#fff" />}
                </button>
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
              placeholder="e.g. Brand Assets, Video Ideas, Travel Receipts"
              className="glass-input"
              style={{ width: '100%' }}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
              Description (Optional)
            </label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What kind of items live here?"
              className="glass-input"
              rows={2}
              style={{ width: '100%', resize: 'none' }}
            />
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            background: 'var(--bg-primary)',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            cursor: 'pointer'
          }} onClick={() => setIsPrivate(!isPrivate)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={16} color={isPrivate ? '#059669' : 'var(--text-muted)'} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Lock as Private</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Require explicit unlock or password check</p>
              </div>
            </div>
            <input 
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            />
          </div>

          <button 
            type="submit"
            disabled={submitting || !name.trim()}
            style={{
              padding: '12px',
              borderRadius: '10px',
              background: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: submitting ? 'wait' : 'pointer',
              marginTop: '8px'
            }}
          >
            {submitting ? 'Creating Folder...' : 'Create Folder'}
          </button>
        </form>
      </div>
    </div>
  );
}
