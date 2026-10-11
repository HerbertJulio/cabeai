import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cabeaí',
    short_name: 'Cabeaí',
    description: 'A planta da sua casa em escala: veja se os móveis cabem. Grátis, com IA.',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ECEEE9',
    theme_color: '#1E5AA8',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }]
  };
}
