'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Search, X, Copy } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function CommandPalette({ isOpen, onClose, token, onEditItem }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(async () => {
      if (!query.trim() || !token) return setItems([]);
      try {
        const response = await axios.get(`${API_BASE}/items`, {
          params: { search: query, limit: 8 },
          headers: { Authorization: `Bearer ${token}` }
        });
        setItems(response.data.items || []);
      } catch {
        setItems([]);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [isOpen, query, token]);

  useEffect(() => {
    const listener = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [onClose]);

  if (!isOpen) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.6)', paddingTop: '12vh' }} onMouseDown={onClose}>
      <div className="glass-panel" onMouseDown={(event) => event.stopPropagation()} style={{ width: 'min(680px, calc(100% - 32px))', margin: 'auto', padding: '16px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Search size={18} color="#94a3b8" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find Wi-Fi, invoice ID, bank IFSC, OCR text…" className="glass-input" style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: 'transparent', border: 0, color: '#94a3b8' }}><X size={18} /></button>
        </div>
        <div style={{ marginTop: '12px', display: 'grid', gap: '6px' }}>
          {items.map((item) => (
            <div key={item._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', borderRadius: '10px', background: 'var(--bg-primary)' }}>
              <button onClick={() => onEditItem(item)} style={{ background: 'transparent', border: 0, color: '#fff', textAlign: 'left', cursor: 'pointer' }}>
                <strong>{item.title}</strong><br /><span style={{ color: '#94a3b8', fontSize: '12px' }}>{item.type} · {item.tags?.join(', ')}</span>
              </button>
              <button onClick={() => navigator.clipboard.writeText(item.content || item.url || item.ocrText || '')} title="Copy result" style={{ background: 'transparent', border: 0, color: '#a5b4fc', cursor: 'pointer' }}><Copy size={16} /></button>
            </div>
          ))}
          {query && !items.length && <p style={{ color: '#94a3b8', textAlign: 'center' }}>No matching vault item.</p>}
        </div>
      </div>
    </div>
  );
}
