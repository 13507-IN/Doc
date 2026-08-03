'use client';
import React, { useState } from 'react';
import { X, Sparkles, Send, Tv, Image as ImageIcon, Link as LinkIcon, FileText, ArrowRight, ExternalLink } from 'lucide-react';
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
      background: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      justifyContent: 'flex-end'
    }}>
      <div className="glass-panel" style={{
        width: '450px',
        maxWidth: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-10px 0 40px rgba(0,0,0,0.6)',
        animation: 'fadeIn 0.25s ease-out'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(18, 21, 38, 0.9)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #ec4899 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff'
            }}>
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                Holder Assistant
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>AI Knowledge Retrieval</p>
            </div>
          </div>

          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Suggested Prompts */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '6px', overflowX: 'auto' }}>
          <PromptChip onClick={() => handleSend('Get all my YouTube links')} label="🎥 YouTube Links" />
          <PromptChip onClick={() => handleSend('Show Brand Assets folder')} label="💼 Brand Assets" />
          <PromptChip onClick={() => handleSend('Find private & important notes')} label="🔒 Private Notes" />
        </div>

        {/* Chat Timeline */}
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '90%',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{
                padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                background: msg.role === 'user' ? 'linear-gradient(135deg, var(--accent-primary) 0%, #4f46e5 100%)' : 'rgba(255, 255, 255, 0.07)',
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
                      borderRadius: '10px',
                      background: 'rgba(10, 12, 22, 0.7)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
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
                    borderRadius: '8px',
                    background: 'rgba(99, 102, 241, 0.2)',
                    border: '1px solid var(--accent-primary)',
                    color: '#a5b4fc',
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
            <div style={{ fontSize: '12px', color: 'var(--accent-pink)', fontStyle: 'italic' }}>
              Searching your personal vault...
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', background: 'rgba(14, 17, 30, 0.95)' }}>
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
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #ec4899 0%, #6366f1 100%)',
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
        padding: '6px 12px',
        borderRadius: '16px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid var(--border-color)',
        color: 'var(--text-muted)',
        fontSize: '11px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        cursor: 'pointer'
      }}
    >
      {label}
    </button>
  );
}
