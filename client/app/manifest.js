export default function manifest() {
  return {
    name: 'Holder — Personal Assistant Vault',
    short_name: 'Holder',
    description: 'Save, organize, and retrieve YouTube videos, links, notes, and screenshots.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0f19',
    theme_color: '#2563eb',
    icons: [
      {
        src: '/icon.svg',
        sizes: '192x192 512x512',
        type: 'image/svg+xml',
        purpose: 'any maskable'
      }
    ],
    share_target: {
      action: '/share',
      method: 'GET',
      params: {
        title: 'title',
        text: 'text',
        url: 'url'
      }
    }
  };
}
