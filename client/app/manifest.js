export default function manifest() {
  return {
    name: 'Holder — Personal Assistant Vault',
    short_name: 'Holder',
    description: 'Save, organize, and retrieve YouTube videos, links, notes, images, and screenshots with 1-tap sharing.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0f19',
    theme_color: '#2563eb',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml'
      }
    ],
    share_target: {
      action: '/share',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
        files: [
          {
            name: 'media',
            accept: [
              'image/*',
              'image/png',
              'image/jpeg',
              'image/jpg',
              'image/webp',
              'image/gif',
              'application/pdf'
            ]
          }
        ]
      }
    }
  };
}
