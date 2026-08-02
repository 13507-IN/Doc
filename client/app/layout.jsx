import './globals.css';

export const metadata = {
  title: 'Holder — Personal Assistant & Info Vault',
  description: 'Your intelligent personal assistant to save, organize, and retrieve YouTube videos, images, links, notes, and brand assets.',
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
