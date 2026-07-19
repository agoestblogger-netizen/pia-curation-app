import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PIA Curation App',
    short_name: 'PIA Curation',
    description: 'Aplikasi Penilaian dan Kurasi Proposal PIA',
    start_url: '/overview',
    display: 'standalone',
    background_color: '#312e81',
    theme_color: '#312e81',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
