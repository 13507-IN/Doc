import './globals.css';

export const metadata = {
  title: 'Holder — Personal Vault Search & Info Organizer',
  description: 'Save and organize links, notes, images, and PDFs. Search saved content with keyword matching and relevance rules; Holder does not generate answers.',
  referrer: 'no-referrer',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' }
    ],
    apple: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }
    ]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Holder'
  }
};

export const viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
