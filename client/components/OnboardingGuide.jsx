'use client';
import React, { useState, useEffect } from 'react';
import { 
  Sparkles, CheckCircle2, Circle, ArrowRight, Zap, 
  Search, Plus, Smartphone, X, ChevronDown, ChevronUp, RotateCcw, Check
} from 'lucide-react';

export default function OnboardingGuide({
  isOpen,
  onClose,
  onLoadDemoPack,
  onTryAI,
  onOpenCommandPalette,
  onOpenAddItem,
  onOpenInstall,
  itemsCount = 0,
  isAppInstalled = false,
  user
}) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [tasks, setTasks] = useState({
    explore: false,
    ai: false,
    search: false,
    save: false,
    install: false
  });
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoLoadedSuccess, setDemoLoadedSuccess] = useState(false);

  // Storage key scoped to user
  const storageKey = `holder_onboarding_tasks_${user?.id || 'guest'}`;

  // Load saved task progress from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setTasks(prev => ({ ...prev, ...parsed }));
      }
    } catch (e) {}
  }, [storageKey]);

  // If user has vault items, mark explore task as completed
  useEffect(() => {
    if (itemsCount > 0) {
      setTasks(prev => {
        if (prev.explore) return prev;
        const updated = { ...prev, explore: true };
        try { localStorage.setItem(storageKey, JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
    }
  }, [itemsCount, storageKey]);

  // If app is already installed PWA, mark install as completed
  useEffect(() => {
    if (isAppInstalled) {
      setTasks(prev => {
        if (prev.install) return prev;
        const updated = { ...prev, install: true };
        try { localStorage.setItem(storageKey, JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
    }
  }, [isAppInstalled, storageKey]);

  const markTask = (key) => {
    setTasks(prev => {
      const updated = { ...prev, [key]: true };
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleDemoClick = async () => {
    setLoadingDemo(true);
    try {
      if (onLoadDemoPack) {
        await onLoadDemoPack();
        setDemoLoadedSuccess(true);
        markTask('explore');
        setTimeout(() => setDemoLoadedSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleReset = () => {
    const fresh = { explore: itemsCount > 0, ai: false, search: false, save: false, install: isAppInstalled };
    setTasks(fresh);
    try { localStorage.setItem(storageKey, JSON.stringify(fresh)); } catch (e) {}
  };

  const totalTasks = 5;
  const completedCount = Object.values(tasks).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / totalTasks) * 100);
  const isAllComplete = completedCount === totalTasks;

  if (!isOpen) return null;

  // Floating Minimized Pill
  if (isMinimized) {
    return (
      <div 
        className="glass-panel animate-scale-in"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 90,
          borderRadius: '100px',
          padding: '8px 16px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid var(--accent-primary)',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer'
        }}
        onClick={() => setIsMinimized(false)}
      >
        <div style={{
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          background: isAllComplete ? '#059669' : 'var(--accent-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: '11px',
          fontWeight: 700
        }}>
          {isAllComplete ? <Check size={14} strokeWidth={2.5} /> : `${completedCount}/${totalTasks}`}
        </div>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>
          {isAllComplete ? 'Guide Completed' : 'Interactive Guide'}
        </span>
        <ChevronUp size={15} color="var(--text-muted)" />
      </div>
    );
  }

  return (
    <div 
      className="glass-panel animate-fade-in"
      style={{
        borderRadius: '18px',
        marginBottom: '24px',
        border: '1px solid rgba(37, 99, 235, 0.3)',
        background: 'linear-gradient(180deg, rgba(21, 29, 42, 0.98) 0%, rgba(11, 15, 25, 0.98) 100%)',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.4), 0 0 25px rgba(37, 99, 235, 0.1)',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Top Banner Bar */}
      <div style={{
        padding: '16px 20px',
        background: 'rgba(37, 99, 235, 0.12)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '9px',
            background: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
          }}>
            <Sparkles size={16} />
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Getting Started with Holder</span>
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '100px',
                background: isAllComplete ? 'rgba(5, 150, 105, 0.2)' : 'rgba(37, 99, 235, 0.2)',
                color: isAllComplete ? '#34d399' : '#93c5fd',
                border: isAllComplete ? '1px solid rgba(5, 150, 105, 0.4)' : '1px solid rgba(37, 99, 235, 0.4)',
                fontWeight: 600
              }}>
                {completedCount} of {totalTasks} Completed
              </span>
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Explore the core superpowers of your personal vault in 5 quick steps.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isAllComplete && (
            <button
              onClick={handleReset}
              title="Reset Tour Checklist"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px'
              }}
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}

          <button
            onClick={() => setIsMinimized(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 8px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 600
            }}
            title="Minimize Guide"
          >
            <ChevronDown size={14} />
            <span>Minimize</span>
          </button>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Dismiss Guide"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.08)' }}>
        <div 
          style={{ 
            height: '100%', 
            width: `${progressPercent}%`, 
            background: isAllComplete ? '#059669' : 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
            transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)' 
          }} 
        />
      </div>

      {/* Task Checklist Body */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        
        {/* Step 1: Starter Pack */}
        <GuideTaskRow
          isDone={tasks.explore}
          step="1"
          title="Load Starter Pack (Interactive Demo Items)"
          description="Instant realistic samples: Delta flight screenshot with OCR & website links, YouTube talk with notes, and web bookmark."
          actionBtn={
            tasks.explore ? (
              <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} />
                <span>Vault Ready</span>
              </span>
            ) : (
              <button
                onClick={handleDemoClick}
                disabled={loadingDemo}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: loadingDemo ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)'
                }}
              >
                <Zap size={13} />
                <span>{loadingDemo ? 'Adding Items...' : demoLoadedSuccess ? 'Loaded!' : 'Load Starter Pack'}</span>
              </button>
            )
          }
        />

        {/* Step 2: Try AI Search */}
        <GuideTaskRow
          isDone={tasks.ai}
          step="2"
          title="Ask the AI Assistant for Flight Wi-Fi"
          description="Ask questions in plain English to automatically extract passwords, codes, and websites from screenshot text."
          actionBtn={
            <button
              onClick={() => {
                if (onTryAI) onTryAI('Find the flight Wi-Fi password in my screenshots');
                markTask('ai');
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: tasks.ai ? 'rgba(37, 99, 235, 0.15)' : 'rgba(37, 99, 235, 0.25)',
                border: '1px solid rgba(37, 99, 235, 0.4)',
                color: '#93c5fd',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Sparkles size={13} color="#60a5fa" />
              <span>{tasks.ai ? 'Test Again' : 'Try: "Find Wi-Fi password"'}</span>
            </button>
          }
        />

        {/* Step 3: Command Palette */}
        <GuideTaskRow
          isDone={tasks.search}
          step="3"
          title="Instant Search with Command Palette"
          description="Press ⌘K (or Ctrl+K) anywhere to instantly jump to any video, image, link, or note in milliseconds."
          actionBtn={
            <button
              onClick={() => {
                if (onOpenCommandPalette) onOpenCommandPalette();
                markTask('search');
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                color: '#f1f5f9',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Search size={13} />
              <span>Open ⌘K Palette</span>
            </button>
          }
        />

        {/* Step 4: Save First Item */}
        <GuideTaskRow
          isDone={tasks.save}
          step="4"
          title="Save a YouTube Video, Link, or Screenshot"
          description="Add anything you care about to organize in folders, set auto-expirations, or extract text."
          actionBtn={
            <button
              onClick={() => {
                if (onOpenAddItem) onOpenAddItem();
                markTask('save');
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                color: '#f1f5f9',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={14} color="#60a5fa" />
              <span>Save Item</span>
            </button>
          }
        />

        {/* Step 5: Install Mobile / Desktop App */}
        <GuideTaskRow
          isDone={tasks.install}
          step="5"
          title="Install App for 1-Tap Mobile Sharing"
          description="Install Holder on Android or iPhone to appear in your system share sheet for 1-tap screenshot saving."
          actionBtn={
            tasks.install ? (
              <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} />
                <span>Installed</span>
              </span>
            ) : (
              <button
                onClick={() => {
                  if (onOpenInstall) onOpenInstall();
                  markTask('install');
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'rgba(37, 99, 235, 0.15)',
                  border: '1px solid rgba(37, 99, 235, 0.4)',
                  color: '#93c5fd',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Smartphone size={13} color="#60a5fa" />
                <span>Install App</span>
              </button>
            )
          }
        />

      </div>
    </div>
  );
}

function GuideTaskRow({ isDone, step, title, description, actionBtn }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '14px',
      padding: '10px 14px',
      borderRadius: '12px',
      background: isDone ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.04)',
      border: isDone ? '1px solid rgba(5, 150, 105, 0.25)' : '1px solid var(--border-color)',
      transition: 'all 0.15s ease'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0, flex: 1 }}>
        <div style={{ marginTop: '2px', flexShrink: 0 }}>
          {isDone ? (
            <CheckCircle2 size={18} color="#059669" />
          ) : (
            <Circle size={18} color="var(--text-dim)" />
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{
            fontSize: '13px',
            fontWeight: 600,
            color: isDone ? 'var(--text-muted)' : '#ffffff',
            textDecoration: isDone ? 'line-through' : 'none',
            margin: 0
          }}>
            {title}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-dim)', margin: '2px 0 0', lineHeight: 1.4 }}>
            {description}
          </p>
        </div>
      </div>

      <div style={{ flexShrink: 0 }}>
        {actionBtn}
      </div>
    </div>
  );
}
