'use client';
import React, { useState } from 'react';
import { X, Sparkles, Send, ArrowRight, ExternalLink } from 'lucide-react';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function AIAssistantDrawer({ isOpen, onClose, onSelectFolder, token }) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hello! I am your Personal Vault Assistant. Ask me anything like: "Get all my YouTube links", "What is inside my Brand Assets folder?", or "Find private notes"!'
    }
  ]);
  const [loading, setLoading] = useState(false);

  const handleSend = async (promptText) => {
    const textToSend = promptText || query;
    if (!textToSend || !textToSend.trim()) return;

    const userMsg = { role: 'user', text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    if (!promptText) setQuery('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE}/assistant/query`, { query: textToSend }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.data.success) {
        const assistantMsg = {
          role: 'assistant',
          text: res.data.answer,
          items: res.data.matchedItems || [],
          targetFolder: res.data.targetFolder
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Sorry, I ran into an issue searching your vault. Please ensure you are logged in.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 90,
      background: 'rgba(11, 15, 25, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      justifyContent: 'flex-end'
    }}>
      <div className="glass-panel" style={{
        width: '440px',
        maxWidth: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-8px 0 30px rgba(0,0,0,0.4)',
        animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-secondary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                  Holder Assistant
                </h3>
                <span style={{ fontSize: '10px', color: '#059669', background: 'rgba(5, 150, 105, 0.15)', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>
                  ● Ready
                </span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AI Knowledge Retrieval Engine</p>
            </div>
          </div>

          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Suggested Prompts */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '6px', overflowX: 'auto', background: 'var(--bg-primary)' }}>
          <PromptChip onClick={() => handleSend('Get all my YouTube links')} label="🎥 YouTube Links" />
          <PromptChip onClick={() => handleSend('Show Brand Assets folder')} label="💼 Brand Assets" />
          <PromptChip onClick={() => handleSend('Find private & important notes')} label="🔒 Private Notes" />
        </div>

        {/* Chat Timeline */}
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--bg-secondary)' }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '90%',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{
                padding: '11px 15px',
                borderRadius: msg.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-primary)',
                color: '#fff',
                fontSize: '13px',
                lineHeight: '1.5',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border-color)'
              }}>
                {msg.text}
              </div>

              {msg.items && msg.items.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  {msg.items.map(item => (
                    <div key={item._id} style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}>
                      <div style={{ overflow: 'hidden' }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {item.title}
                        </p>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {item.type.toUpperCase()} {item.folderId ? `• ${item.folderId.name}` : ''}
                        </span>
                      </div>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', padding: '2px' }}>
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {msg.targetFolder && (
                <button 
                  onClick={() => { onSelectFolder(msg.targetFolder.id); onClose(); }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: 'rgba(37, 99, 235, 0.15)',
                    border: '1px solid var(--accent-primary)',
                    color: '#93c5fd',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    alignSelf: 'flex-start'
                  }}
                >
                  <span>Open {msg.targetFolder.name} Folder</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ fontSize: '12px', color: '#60a5fa', fontStyle: 'italic' }}>
              Searching your personal vault...
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            style={{ display: 'flex', gap: '8px' }}
          >
            <input 
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask assistant to find videos, links, notes..."
              className="glass-input"
              style={{ flex: 1, fontSize: '13px' }}
            />
            <button 
              type="submit"
              disabled={loading}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function PromptChip({ onClick, label }) {
  return (
    <button 
      onClick={onClick}
      style={{
        padding: '5px 10px',
        borderRadius: '6px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        color: 'var(--text-muted)',
        fontSize: '11px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition: 'all 0.15s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent-primary)';
        e.currentTarget.style.color = '#fff';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-color)';
        e.currentTarget.style.color = 'var(--text-muted)';
      }}
    >
      {label}
    </button>
  );
}
