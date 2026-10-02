'use client';
import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const userParam = searchParams.get('user');

    if (token && userParam) {
      try {
        const userObj = JSON.parse(decodeURIComponent(userParam));

        localStorage.setItem('holder_token', token);
        localStorage.setItem('holder_user', JSON.stringify(userObj));

        // Broadcast postMessage to sync with Chrome Extension instantly
        if (typeof window !== 'undefined') {
          window.postMessage({ type: 'HOLDER_AUTH_TOKEN', token, user: userObj }, '*');
        }

        router.replace('/');
      } catch (err) {
        console.error('OAuth Callback Error:', err);
        router.replace('/?error=oauth_parse');
      }
    } else {
      router.replace('/');
    }
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
