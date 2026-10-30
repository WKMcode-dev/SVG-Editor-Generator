import { make } from '../domain/shape-factory';
import type { Shape, Point } from '../domain/models';
import * as G from '../domain/geometry';
export async function importMedia(file: File, center: Point): Promise<Shape> {
  if (file.size > 12_000_000) throw Error('Use imagens ou vídeos de até 12 MB por arquivo.');
  const image = /^image\/(png|jpeg|webp|gif|avif)$/.test(file.type),
    video = /^video\/(mp4|webm|ogg)$/.test(file.type);
  if (!image && !video) throw Error('Escolha PNG, JPG, WebP, GIF, AVIF, MP4, WebM ou OGG.');
  const src = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(Error('Não foi possível ler o arquivo.'));
    r.readAsDataURL(file);
  });
  const [width, height] = await new Promise<[number, number]>((resolve, reject) => {
    const node = image ? new Image() : document.createElement('video');
    let finished = false;
    const timer = setTimeout(() => fail(), 15000);
    const cleanup = () => {
      clearTimeout(timer);
      if (node instanceof HTMLVideoElement) {
        node.removeAttribute('src');
        node.load();
      }
    };
    const fail = () => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(Error('Arquivo de mídia inválido ou codec não suportado.'));
    };
    const loaded = () => {
      if (finished) return;
      const w = node instanceof HTMLImageElement ? node.naturalWidth : node.videoWidth,
        h = node instanceof HTMLImageElement ? node.naturalHeight : node.videoHeight;
      if (!w || !h) return fail();
      finished = true;
      cleanup();
      resolve([w, h]);
    };
    node.onerror = fail;
    if (image) node.onload = loaded;
    else {
      node.onloadedmetadata = loaded;
      (node as HTMLVideoElement).preload = 'metadata';
    }
    node.src = src;
  });
  const scale = Math.min(1, 600 / width, 500 / height),
    w = width * scale,
    h = height * scale,
    shape = make(image ? 'image' : 'video');
  shape.name = file.name.slice(0, 80);
  shape.points = G.points('rectangle', center[0] - w / 2, center[1] - h / 2, w, h);
  shape.media = { src, mime: file.type };
  shape.strokeWidth = 0;
  return shape;
}
