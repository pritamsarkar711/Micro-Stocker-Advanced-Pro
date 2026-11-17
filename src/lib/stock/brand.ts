import type { PlatformId } from './types';

export interface PlatformBrand {
  name: string;
  color: string;
  site: string;
  /** Solid brand badge background for featured HD marks. */
  badgeBg?: string;
  badgeFg?: string;
  /** Featured platforms rendered slightly larger in HD tiles. */
  featured?: boolean;
  glyph?: string;
  viewBox?: string;
  monogram?: string;
  wide?: boolean;
  multicolor?: boolean;
}

export const PLATFORM_BRAND: Record<PlatformId, PlatformBrand> = {
  shutterstock: {
    name: 'Shutterstock',
    color: '#EE2B24',
    badgeBg: '#EE2B24',
    badgeFg: '#FFFFFF',
    featured: true,
    site: 'https://submit.shutterstock.com',
    viewBox: '0 0 24 24',
    glyph:
      '<path fill="currentColor" d="M9.839 18.761h5.313a1.53 1.53 0 0 0 1.527-1.528v-5.76h5.237v5.76A6.767 6.767 0 0 1 15.152 24H9.839v-5.239ZM14.16 5.237H8.85a1.53 1.53 0 0 0-1.53 1.527v5.761H2.085V6.764A6.763 6.763 0 0 1 8.85 0h5.31v5.237Z"/>',
  },
  adobe: {
    name: 'Adobe Stock',
    color: '#EB1000',
    badgeBg: '#EB1000',
    badgeFg: '#FFFFFF',
    featured: true,
    site: 'https://contributor.stock.adobe.com',
    viewBox: '0 0 24 24',
    glyph:
      '<path fill="currentColor" d="M14.86 3H22v18l-7.14-18ZM9.14 3H2v18L9.14 3Zm2.86 6.68L16.65 21h-3.18l-1.36-3.62H9.38l2.62-7.7Z"/>',
  },
  freepik: {
    name: 'Magnific',
    color: '#E0218A',
    badgeBg: '#E0218A',
    badgeFg: '#FFFFFF',
    featured: true,
    site: 'https://www.magnific.com',
    viewBox: '0 0 24 24',
    // Magnific (formerly Freepik): flat pink tile with the "M" monogram and spark.
    glyph:
      '<path fill="currentColor" fill-rule="evenodd" d="M4.6 2h14.8A2.6 2.6 0 0 1 22 4.6v14.8a2.6 2.6 0 0 1-2.6 2.6H4.6A2.6 2.6 0 0 1 2 19.4V4.6A2.6 2.6 0 0 1 4.6 2Zm2.05 14.9V8.5c0-.9 1.07-1.36 1.7-.72L12 11.5l3.65-3.72c.63-.64 1.7-.18 1.7.72v8.4h-2.3v-4.6L12 15.4l-3.05-3.1v4.6h-2.3Z"/>',
  },
  pixabay: {
    name: 'Pixabay',
    color: '#00AB6C',
    site: 'https://pixabay.com/service/about/',
    glyph:
      '<path fill="currentColor" d="M2 0a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2Zm10.193 5.5h2.499l1.967 2.872L18.854 5.5h2.482l-3.579 4.592 3.91 4.813h-2.638l-2.395-3.064-2.15 3.064h-2.579l3.579-4.813Zm-5.045.004q1.98.05 3.3 1.371 1.318 1.321 1.37 3.317-.052 1.997-1.37 3.328-1.32 1.33-3.3 1.38H4.346v3.768H2.5v-8.476q.049-1.995 1.359-3.317 1.31-1.321 3.29-1.37Zm0 1.864q-1.196.03-1.985.823-.787.794-.817 2v2.847h2.802q1.212-.028 2.003-.826.791-.799.82-2.02-.029-1.206-.82-2-.79-.795-2.003-.824"/>',
  },
  dreamstime: {
    name: 'Dreamstime',
    color: '#50A901',
    site: 'https://www.dreamstime.com/upload-images',
    glyph:
      '<path fill="currentColor" d="M21.532 5.153C16.952-1.604 7.118-.402 2.764 4.628.586 7.105-.241 10.558.059 13.711c.3 2.478 1.201 4.73 2.478 6.231 3.378 4.13 9.234 4.58 13.063 1.953 5.405-3.755 5.03-9.834 2.102-13.214-5.255-6.006-14.264-.075-10.885 6.757.825 1.65 2.7 2.552 4.429 2.552 2.402 0 4.279-2.852 3.153-4.579-1.126-1.802-3.078 0-2.253 1.35.676 1.052-.75 1.653-1.35 1.503-1.577-.376-2.329-2.553-1.802-4.354.45-1.577 2.1-2.628 3.678-2.553 2.177.15 4.58 1.877 4.354 5.63-.525 6.082-8.484 7.208-11.636 2.853-4.955-6.982.9-16.366 9.835-13.513 4.58 1.5 7.958 6.907 5.855 12.688-.825 2.177-1.275 3.002-1.35 3.754-.377 2.777 8.408-5.856 1.8-15.617Z"/>',
  },
  '123rf': {
    name: '123RF',
    color: '#E4002B',
    site: 'https://www.123rf.com/contributor/',
    monogram: '123',
  },
  depositphotos: {
    name: 'Depositphotos',
    color: '#0F9D58',
    site: 'https://depositphotos.com/contributor.html',
    glyph:
      '<path fill="currentColor" d="M12 24c5.119 0 9.061-3.942 9.061-9.06S17.119 5.88 12 5.88c-5.117 0-9.059 3.942-9.059 9.06S6.883 24 12 24m0-5.598c-1.954 0-3.461-1.508-3.461-3.462s1.507-3.462 3.461-3.462c1.955 0 3.462 1.507 3.462 3.462 0 1.954-1.507 3.462-3.462 3.462m2.634-12.241h6.161V0h-6.161Z"/>',
  },
  vecteezy: {
    name: 'Vecteezy',
    color: '#FF5A1F',
    site: 'https://www.vecteezy.com/contributors',
    glyph:
      '<path fill="currentColor" d="M3.2 4h4.7l4.1 10.6L16.1 4h4.7l-6.8 16h-4L3.2 4Z"/>',
  },
  getty: {
    name: 'Getty Images',
    color: '#1565C0',
    site: 'https://contributors.gettyimages.com',
    monogram: 'g',
  },
  alamy: {
    name: 'Alamy',
    color: '#009B77',
    site: 'https://www.alamy.com/contributors/',
    glyph:
      '<path fill="currentColor" d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12m.058-18.533c2.515 0 3.482 1.404 3.482 3.959v7.04c0 .78 0 1.21.193 1.872H13.47c-.406-.331-.503-1.072-.503-1.423-.464 1.111-1.102 1.618-2.224 1.618-1.354 0-2.476-1.014-2.476-3.257 0-2.626 1.618-3.566 2.956-4.343.937-.545 1.736-1.009 1.744-1.917 0-.858-.29-1.15-.909-1.15-.696 0-.987.468-.987 1.56v.429H8.5v-.37c0-2.614 1.006-4.018 3.559-4.018Zm-.213 10.667c.6 0 .948-.526 1.122-.8v-3.393c-.209.345-.544.621-.887.904-.608.5-1.24 1.023-1.24 1.983 0 .838.367 1.306 1.005 1.306"/>',
  },
  pond5: {
    name: 'Pond5',
    color: '#1DB954',
    site: 'https://www.pond5.com/artist',
    glyph:
      '<path fill="currentColor" d="M21.504 11.385h.755c.92 0 1.747.286 1.741 1.388 0 1.047-.932 1.412-1.717 1.412-.993 0-1.75-.359-1.754-1.37v-.14h.944v.14c0 .384.442.53.798.53.233 0 .784-.085.784-.572.006-.475-.508-.572-.797-.572h-1.644V9.875h3.146v.853h-2.256Zm-4.167 2.745h-1.76V9.87h1.76c1.478 0 2.134.985 2.134 2.1 0 1.113-.632 2.16-2.134 2.16m0-3.402h-.816v2.526h.816c.932 0 1.19-.682 1.19-1.297s-.295-1.23-1.19-1.23Zm-6.055 1.14v2.262h-.955V9.81l.134-.023 2.598 2.33V9.869h.957v4.333l-.1.017Zm-4.431 2.367c-1.374 0-2.319-.848-2.319-2.235S5.477 9.765 6.851 9.765c1.373 0 2.318.847 2.318 2.235s-.944 2.234-2.318 2.234Zm0-3.618c-.816 0-1.38.61-1.38 1.382 0 .798.564 1.376 1.38 1.376.834 0 1.38-.584 1.38-1.376 0-.779-.546-1.382-1.38-1.382m-4.827 2.308h-.587v-.87h.587c.46 0 .686-.299.686-.64 0-.34-.232-.645-.686-.645H.957v3.36H0V9.87h2.024c1.097 0 1.642.705 1.642 1.527 0 .852-.552 1.516-1.643 1.528Z"/>',
  },
  vectorstock: {
    name: 'VectorStock',
    color: '#1565C0',
    site: 'https://www.vectorstock.com/artist',
    monogram: 'VS',
  },
  canva: {
    name: 'Canva',
    color: '#00C4CC',
    site: 'https://www.canva.com/creators/',
    glyph:
      '<path fill="currentColor" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0m3.72 15.84c-1.15 1.48-2.82 2.36-4.74 2.36-3.28 0-5.48-2.46-5.48-5.94 0-3.78 2.52-6.46 6.02-6.46 2.32 0 4.02 1.18 4.42 2.98h-2.54c-.34-.74-1.02-1.14-1.92-1.14-2.02 0-3.36 1.82-3.36 4.58 0 2.48 1.22 4.1 3.08 4.1 1.14 0 2.02-.56 2.58-1.56l1.94 1.08Z"/>',
  },
  envato: {
    name: 'Envato Elements',
    color: '#6CA12B',
    site: 'https://elements.envato.com',
    glyph:
      '<path fill="currentColor" d="M16.156 0a2.7 2.7 0 0 0-1.886.8L4 11.253c-.382.42-.558.978-.453 1.57.176.945 1.116 1.571 2.06 1.399l5.54-1.13c.12-.025.183.136.082.204L5.088 17.23c-.769.487-1.119 1.36-.875 2.234.244 1.151 1.398 1.814 2.516 1.537l9.183-2.26a.11.11 0 0 1 .113.176l-1.433 1.77c-.383.487.244 1.15.77.767l4.716-3.877c.84-.697.281-2.062-.803-1.957l-.011-.004-6.047.65a.111.111 0 0 1-.08-.199l5.918-4.609c.382-.315.628-.801.523-1.326-.105-.803-.767-1.328-1.607-1.223l-6.43.942c-.112.015-.174-.128-.084-.2l6.375-4.867c1.256-.978 1.36-2.898.209-4.015A2.6 2.6 0 0 0 16.156 0M13.1 21.855a1.07 1.07 0 0 0-1.073 1.073A1.07 1.07 0 0 0 13.1 24a1.07 1.07 0 0 0 1.072-1.072 1.07 1.07 0 0 0-1.072-1.073"/>',
  },
};
