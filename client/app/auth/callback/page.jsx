'use client';
import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');

    if (!code) {
      router.replace('/?error=oauth_failed');
      return;
    }

    // Remove the short-lived one-time code from browser history before exchanging it.
    window.history.replaceState(null, '', '/auth/callback');
    let cancelled = false;

    fetch(`${API_BASE}/auth/oauth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      body: JSON.stringify({ code })
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success || !result.token || !result.user) {
          throw new Error(result.message || 'Could not complete Google sign-in.');
        }
        if (cancelled) return;

        const userObj = result.user;
        localStorage.setItem('holder_token', result.token);
        localStorage.setItem('holder_user', JSON.stringify(userObj));
        sessionStorage.setItem('holder_just_logged_in', '1');

        // The extension reads the token directly from Holder's localStorage.
        // The message is only a same-origin notification and contains no credentials.
        window.postMessage({ type: 'HOLDER_AUTH_CHANGED' }, window.location.origin);
        router.replace('/');
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('OAuth Callback Error:', err.message);
          router.replace('/?error=oauth_failed');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      color: 'var(--text-muted)',
      fontSize: '14px'
    }}>
      Completing Google Authentication...
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        color: 'var(--text-muted)',
        fontSize: '14px'
      }}>
        Loading Google Authentication...
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
