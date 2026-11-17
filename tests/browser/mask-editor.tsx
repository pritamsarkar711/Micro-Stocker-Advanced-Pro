import { createRoot } from 'react-dom/client';
import { MaskEditor } from '../../src/components/tools/MaskEditor';
import '../../src/index.css';

const source = document.createElement('canvas');
source.width = source.height = 80;
const sctx = source.getContext('2d')!;
sctx.fillStyle = '#ff0000'; sctx.fillRect(0, 0, 80, 80);
const cutout = document.createElement('canvas');
cutout.width = cutout.height = 80;
cutout.getContext('2d')!.drawImage(source, 0, 0);
cutout.getContext('2d')!.clearRect(40, 0, 40, 80);
const blob = (c: HTMLCanvasElement) => new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b!), 'image/png'));
const [original, transparentBlob] = await Promise.all([blob(source), blob(cutout)]);
createRoot(document.getElementById('root')!).render(<MaskEditor source={original} result={{ blob: transparentBlob, transparentBlob, filename: 'test.png', width: 80, height: 80, sizeBytes: transparentBlob.size, usedNeural: false }} onClose={() => {}} onSave={(result) => { (window as unknown as { saved: Blob }).saved = result.blob; }} />);
