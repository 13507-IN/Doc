import './globals.css';

export const metadata = {
  title: 'Holder — Personal Assistant & Info Vault',
  description: 'Your intelligent personal assistant to save, organize, and retrieve YouTube videos, images, links, notes, and brand assets.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg'
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
