/// <reference types="vite/client" />

declare namespace EmscriptenWasm {
  interface Module {
    [key: string]: unknown;
  }
  interface ModuleOpts {
    [key: string]: unknown;
  }
  type ModuleFactory<T extends Module> = (options?: ModuleOpts) => Promise<T>;
}

declare module 'utif2' {
  const UTIF: {
    decode: (buffer: ArrayBuffer) => Array<Record<string, unknown> & { width?: number; height?: number; t256?: number[]; t257?: number[] }>;
    decodeImage: (buffer: ArrayBuffer, ifd: unknown) => void;
    toRGBA8: (ifd: unknown) => Uint8Array;
    encodeImage: (rgba: Uint8Array, width: number, height: number, metadata?: Record<string, unknown>) => ArrayBuffer;
    encode: (ifds: unknown[]) => ArrayBuffer;
  };
  export default UTIF;
}

declare module 'heic-to/csp' {
  export function isHeic(blob: Blob): Promise<boolean>;
  export function heicTo(options: {
    blob: Blob;
    type?: 'image/jpeg' | 'image/png' | 'bitmap';
    quality?: number;
    options?: Record<string, unknown>;
  }): Promise<Blob | ImageBitmap>;
}

declare module 'libheif-js/wasm-bundle' {
  interface HeifImageLike {
    get_width(): number;
    get_height(): number;
    display(target: { data: Uint8ClampedArray; width: number; height: number }, callback: (result: unknown) => void): void;
    free?(): void;
  }
  interface HeifDecoderLike {
    decode(bytes: Uint8Array): HeifImageLike[];
  }
  const libheif: {
    HeifDecoder: new () => HeifDecoderLike;
    HeifImage: unknown;
    [key: string]: unknown;
  };
  export = libheif;
}

declare module '@cornerstonejs/codec-openjpeg/wasmjs' {
  interface OpenJpegEncoder {
    getDecodedBuffer(info: { width: number; height: number; bitsPerSample: number; componentCount: number; isSigned: boolean }): Uint8Array;
    setDecompositions(value: number): void;
    encode(): void;
    getEncodedBuffer(): Uint8Array;
    delete(): void;
  }
  interface OpenJpegDecoder {
    getEncodedBuffer(size: number): Uint8Array;
    decode(): void;
    getFrameInfo(): { width: number; height: number; componentCount: number; bitsPerSample: number };
    getDecodedBuffer(): Uint8Array;
    delete(): void;
  }
  interface OpenJpegModule {
    J2KEncoder: new () => OpenJpegEncoder;
    J2KDecoder: new () => OpenJpegDecoder;
  }
  const factory: (options?: { wasmBinary?: ArrayBuffer | Uint8Array }) => Promise<OpenJpegModule>;
  export default factory;
}

declare module 'pdfjs-dist/build/pdf.mjs' {
  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(options: { data: Uint8Array }): {
    promise: Promise<{
      numPages: number;
      getPage: (number: number) => Promise<{
        getViewport: (options: { scale: number }) => { width: number; height: number };
        render: (options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
      }>;
      destroy: () => Promise<void>;
    }>;
  };
}

declare module '*?url' {
  const url: string;
  export default url;
}

declare module '*.wasm?url' {
  const url: string;
  export default url;
}

declare module '*.mjs?url' {
  const url: string;
  export default url;
}
