'use client';
import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, Smartphone, Sparkles, Check, X, ArrowRight, Zap, ShieldCheck } from 'lucide-react';

export default function InstallAppModal({
  isOpen,
  onClose,
  deferredPrompt,
  onInstalled
}) {
  const [platform, setPlatform] = useState('other'); // 'ios' | 'android' | 'desktop' | 'other'
  const [isInstalling, setIsInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroidDevice = /android/.test(ua);

    if (isIOSDevice) {
      setPlatform('ios');
    } else if (isAndroidDevice) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }
  }, []);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      setIsInstalling(true);
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult && choiceResult.outcome === 'accepted') {
          setInstallSuccess(true);
          if (onInstalled) onInstalled();
          setTimeout(() => {
            onClose();
          }, 1800);
        }
      } catch (err) {
        console.error('Error triggering PWA install prompt:', err);
      } finally {
        setIsInstalling(false);
      }
    }
  };

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('holder_pwa_dismissed', Date.now().toString());
    }
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 250,
      background: 'rgba(11, 15, 25, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div 
        className="glass-panel animate-scale-in"
        style={{
          width: '100%',
          maxWidth: '440px',
          borderRadius: '20px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(37, 99, 235, 0.15)',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'background 0.15s ease',
            zIndex: 10
          }}
          title="Dismiss"
        >
          <X size={16} />
        </button>

        {/* Header Hero */}
        <div style={{
          padding: '28px 24px 20px',
          textAlign: 'center',
          background: 'linear-gradient(180deg, rgba(37, 99, 235, 0.12) 0%, rgba(21, 29, 42, 0) 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          {/* App Icon */}
          <div style={{
            width: '68px',
            height: '68px',
            margin: '0 auto 14px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(37, 99, 235, 0.45)',
            border: '2px solid rgba(255, 255, 255, 0.2)'
          }}>
            <Zap size={34} color="#ffffff" fill="#ffffff" />
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(37, 99, 235, 0.2)',
            border: '1px solid rgba(37, 99, 235, 0.4)',
            padding: '3px 10px',
            borderRadius: '100px',
            fontSize: '11px',
            fontWeight: 600,
            color: '#93c5fd',
            marginBottom: '8px'
          }}>
            <Sparkles size={12} />
            <span>Recommended Experience</span>
          </div>

          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '20px',
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-0.3px',
            marginBottom: '6px'
          }}>
            Install Holder App
          </h2>

          <p style={{
            fontSize: '13px',
            color: 'var(--text-muted)',
            lineHeight: 1.45,
            maxWidth: '340px',
            margin: '0 auto'
          }}>
            Add Holder to your home screen for instant 1-tap sharing from any app and a clean fullscreen experience.
          </p>
        </div>

        {/* Benefits List */}
        <div style={{ padding: '20px 24px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(37, 99, 235, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#60a5fa'
            }}>
              <Share size={16} />
            </div>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                1-Tap Direct Sharing
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Share videos from YouTube or links from your browser directly into Holder.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(5, 150, 105, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#34d399'
            }}>
              <Smartphone size={16} />
            </div>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                Native Fullscreen App
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                No browser address bars or tabs. Smooth, distraction-free performance.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(217, 119, 6, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#fbbf24'
            }}>
              <ShieldCheck size={16} />
            </div>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
                Offline Vault Access
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                View your saved links and notes instantly even on spotty internet.
              </p>
            </div>
          </div>
        </div>

        {/* Platform Specific Action / Instructions */}
        <div style={{ padding: '0 24px 24px' }}>
          {installSuccess ? (
            <div style={{
              background: 'rgba(5, 150, 105, 0.15)',
              border: '1px solid rgba(5, 150, 105, 0.3)',
              borderRadius: '12px',
              padding: '14px',
              textAlign: 'center',
              color: '#34d399',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: 600,
              fontSize: '14px'
            }}>
              <Check size={18} />
              <span>Holder is installed! Opening now...</span>
            </div>
          ) : platform === 'ios' ? (
            /* iOS Safari Step-by-Step Instructions */
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '14px'
            }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#93c5fd', marginBottom: '8px' }}>
                How to install on iPhone & iPad:
              </p>
              <ol style={{
                margin: 0,
                paddingLeft: '18px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.6
              }}>
                <li>
                  Tap the <strong style={{ color: '#fff' }}>Share</strong> button <Share size={13} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 2px' }} /> in Safari's bottom toolbar.
                </li>
                <li>
                  Scroll down and tap <strong style={{ color: '#fff' }}>Add to Home Screen</strong> <PlusSquare size={13} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 2px' }} />.
                </li>
                <li>
                  Tap <strong style={{ color: '#fff' }}>Add</strong> at top right to finish!
                </li>
              </ol>
            </div>
          ) : deferredPrompt ? (
            /* 1-Click Install Button for Chrome / Android / Desktop */
            <button
              onClick={handleInstallClick}
              disabled={isInstalling}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: isInstalling ? 'wait' : 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                transition: 'all 0.15s ease',
                marginBottom: '10px'
              }}
            >
              <Download size={18} />
              <span>{isInstalling ? 'Installing Holder...' : 'Install Holder App'}</span>
            </button>
          ) : (
            /* Chrome / Browser fallback when deferredPrompt not captured yet */
            <div style={{ marginBottom: '12px' }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '12px 14px',
                marginBottom: '10px'
              }}>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {platform === 'android' ? (
                    <>Tap browser menu (<strong>⋮</strong>) at top-right &gt; select <strong style={{ color: '#60a5fa' }}>"Install app"</strong> or <strong style={{ color: '#60a5fa' }}>"Add to Home screen"</strong>.</>
                  ) : (
                    <>Look for the <strong style={{ color: '#60a5fa' }}>Install icon</strong> in your browser address bar, or open menu (⋮) &gt; <strong style={{ color: '#60a5fa' }}>"Install Holder"</strong>.</>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Dismiss Button */}
          <button
            onClick={handleDismiss}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '10px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'color 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
