import * as G from '../domain/geometry';
import { make } from '../domain/shape-factory';
import type { Shape, ShapeType, Point, Ring, RadiusUnit } from '../domain/models';
function color(value: string | null, fallback: string) {
  if (!value) return fallback;
  if (!/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value))
    throw Error('Use cores hexadecimais (#RGB ou #RRGGBB) ou fill="none".');
  return value.length === 4 ? '#' + [...value.slice(1)].map((c) => c + c).join('') : value;
}
export function parseCode(text: string, shapes: Shape[] = []) {
  if (text.length > 50_000_000) throw Error('Código muito grande.');
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) {
    const text = doc.querySelector('parsererror')!.textContent || '';
    const at = text.match(/line (\d+).*column (\d+)/i);
    throw Object.assign(
      Error('SVG incompleto ou XML inválido. Confira aspas e fechamento das tags.'),
      { line: at ? Number(at[1]) : 1 },
    );
  }
  const svg =
    doc.documentElement.localName === 'svg' ? doc.documentElement : doc.querySelector('svg');
  if (!svg) throw Error('Inclua um elemento <svg>.');
  const box = svg.getAttribute('viewBox');
  if (box) {
    const numbers = box
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (
      numbers.length !== 4 ||
      !numbers.every(Number.isFinite) ||
      numbers[2] <= 0 ||
      numbers[3] <= 0
    )
      throw Error('viewBox inválido.');
  }
  const children = [...svg.children].filter(
    (n) => !['title', 'desc', 'defs'].includes(n.localName),
  );
  if (children.length > 100) throw Error('Limite de 100 formas.');
  const parsed = children.map((node, i) => {
    if (!['path', 'polygon', 'rect', 'ellipse', 'line', 'image', 'g'].includes(node.localName))
      throw Error(
        'Use path, polygon ou rect. Grupos, curvas e outros elementos ainda não são suportados.',
      );
    const typo = [...node.attributes].find((a) =>
      ['stoke', 'stroke-wdith', 'stroke-witdh'].includes(a.name),
    );
    if (typo) throw Error(`Atributo ${typo.name} inválido. Use stroke ou stroke-width.`);
    if (
      [...node.attributes].some(
        (a) => a.name.startsWith('on') || ['transform', 'style'].includes(a.name),
      )
    )
      throw Error('Use atributos diretos de cor e coordenadas, sem style, transform ou eventos.');
    const old = shapes.find((s) => s.id === node.getAttribute('id')) || shapes[i];
    const editorType = (node.getAttribute('data-editor-type') || 'custom') as ShapeType;
    let media: Shape['media'];
    let pts: Ring,
      polygons: Shape['polygons'],
      radius = 0,
      radiusUnit: RadiusUnit = 'px',
      cornerRadii: Shape['cornerRadii'],
      regeneratePath = false;
    if (['image', 'video'].includes(editorType) || node.localName === 'image') {
      const isVideo = editorType === 'video';
      const content = isVideo
        ? node.querySelector('video')
        : node.localName === 'image'
          ? node
          : node.querySelector('image');
      if (!content) throw Error('Mídia ausente.');
      const boundsNode = node.localName === 'g' ? node.firstElementChild! : node;
      const vertices = node.getAttribute('data-vertices');
      pts = vertices
        ? JSON.parse(vertices)[0][0]
        : G.points(
            'rectangle',
            Number(boundsNode.getAttribute('x') || 0),
            Number(boundsNode.getAttribute('y') || 0),
            Number(boundsNode.getAttribute('width')),
            Number(boundsNode.getAttribute('height')),
          );
      media = {
        ...JSON.parse(node.getAttribute('data-media') || '{}'),
        src: content.getAttribute(isVideo ? 'src' : 'href') || '',
        mime:
          JSON.parse(node.getAttribute('data-media') || '{}').mime ||
          (content.getAttribute('href') || '').match(/^data:([^;]+)/)?.[1] ||
          '',
      };
    } else if (node.hasAttribute('data-boolean')) {
      polygons = JSON.parse(node.getAttribute('data-vertices') || 'null');
      pts = polygons![0][0];
    } else if (node.localName === 'ellipse') {
      const cx = Number(node.getAttribute('cx')),
        cy = Number(node.getAttribute('cy')),
        rx = Number(node.getAttribute('rx')),
        ry = Number(node.getAttribute('ry'));
      if (!(rx > 0 && ry > 0)) throw Error('Raio da elipse inválido.');
      pts = G.points('ellipse', cx - rx, cy - ry, rx * 2, ry * 2);
    } else if (node.localName === 'line') {
      pts = [
        [Number(node.getAttribute('x1')), Number(node.getAttribute('y1'))],
        [Number(node.getAttribute('x2')), Number(node.getAttribute('y2'))],
      ];
    } else if (
      node.hasAttribute('data-vertices') &&
      ['ellipse', 'line', 'arrow'].includes(editorType)
    ) {
      pts = JSON.parse(node.getAttribute('data-vertices') || 'null')[0][0];
      if (editorType === 'line' || editorType === 'arrow') {
        const d = node.getAttribute('d') || '',
          oldPath = old ? G.shapePath(old) : '';
        if (d !== oldPath) {
          const segment = d.match(
            /^\s*M\s*([-+\d.eE]+)[ ,]+([-+\d.eE]+)\s*L\s*([-+\d.eE]+)[ ,]+([-+\d.eE]+)/,
          );
          if (segment)
            pts = [
              [Number(segment[1]), Number(segment[2])],
              [Number(segment[3]), Number(segment[4])],
            ];
        }
      }
    } else if (
      node.localName === 'path' &&
      node.hasAttribute('data-vertices') &&
      /[Aa]/.test(node.getAttribute('d') || '')
    ) {
      polygons = JSON.parse(node.getAttribute('data-vertices') || 'null');
      pts = polygons![0][0];
      radius = Number(node.getAttribute('data-corner-radius') || 0);
      radiusUnit = (node.getAttribute('data-radius-unit') || 'px') as RadiusUnit;
      cornerRadii = node.hasAttribute('data-corner-radii')
        ? JSON.parse(node.getAttribute('data-corner-radii') || 'null')
        : undefined;
      const candidate = {
        ...make('rectangle'),
        points: pts,
        polygons,
        radius,
        radiusUnit,
        cornerRadii,
      };
      if (!G.valid({ version: 1, shapes: [candidate] }))
        throw Error('Corner radius ou vértices inválidos.');
      const compact = (text: string) => text.replace(/[\s,]+/g, ' ').trim(),
        d = compact(node.getAttribute('d') || '');
      if (d !== compact(G.shapePath(candidate)) && (!old || d !== compact(G.shapePath(old))))
        throw Error(
          'Para alterar os cantos deste path, edite data-corner-radius, data-radius-unit ou data-vertices.',
        );
      regeneratePath = d !== compact(G.shapePath(candidate));
    } else if (node.localName === 'path') {
      const contours = G.parseContours(node.getAttribute('d') || '');
      if (contours.length > 1) {
        polygons = G.fromContours(contours);
        if (!polygons.length) throw Error('O path não gerou área.');
        pts = polygons[0][0];
      } else pts = contours[0];
    } else if (node.localName === 'polygon') {
      const values = (node.getAttribute('points') || '')
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      if (values.length % 2 || !values.every(Number.isFinite))
        throw Error('Pontos do polygon inválidos.');
      pts = [];
      for (let n = 0; n < values.length; n += 2) pts.push([values[n], values[n + 1]] as Point);
    } else {
      const x = Number(node.getAttribute('x') || 0),
        y = Number(node.getAttribute('y') || 0),
        w = Number(node.getAttribute('width')),
        h = Number(node.getAttribute('height'));
      if (!(w > 0 && h > 0) || node.hasAttribute('rx') || node.hasAttribute('ry'))
        throw Error('Use um rect com largura e altura positivas, sem rx/ry.');
      pts = G.points('rectangle', x, y, w, h);
    }
    const s: Shape = {
      ...make('rectangle'),
      id: node.getAttribute('id') || old?.id || crypto.randomUUID(),
      type: media
        ? editorType === 'video'
          ? 'video'
          : 'image'
        : node.localName === 'ellipse'
          ? 'ellipse'
          : node.localName === 'line'
            ? 'line'
            : ['ellipse', 'line', 'arrow', 'star'].includes(editorType)
              ? editorType
              : 'custom',
      media,
      locked: node.getAttribute('data-locked') === 'true',
      hidden: node.getAttribute('data-hidden') === 'true',
      shadow: node.getAttribute('data-shadow') === 'true',
      group: node.hasAttribute('data-group')
        ? JSON.parse(node.getAttribute('data-group') || 'null')
        : undefined,
      name: (node.getAttribute('aria-label') || old?.name || 'Forma ' + (i + 1)).slice(0, 80),
      points: pts,
      radius,
      radiusUnit,
      cornerRadii,
    };
    if (polygons) s.polygons = polygons;
    if (regeneratePath) Object.defineProperty(s, 'regeneratePath', { value: true });
    const attr = (key: string) => node.getAttribute(key) ?? svg.getAttribute(key);
    const fill = attr('fill');
    s.noFill = fill === 'none' || ['line', 'arrow'].includes(s.type);
    s.fill = color(s.noFill ? null : fill, old?.fill || '#d9d9d9');
    s.stroke = color(attr('stroke') === 'none' ? null : attr('stroke'), old?.stroke || '#737373');
    s.strokeWidth = attr('stroke') === 'none' ? 0 : Number(attr('stroke-width') ?? 2);
    s.opacity = Number(attr('opacity') ?? 1) * 100;
    s.join = (attr('stroke-linejoin') || 'miter') as Shape['join'];
    return s;
  });
  children.forEach((node, i) => {
    if (!node.hasAttribute('data-boolean')) return;
    const data = JSON.parse(node.getAttribute('data-boolean')!);
    if (!Array.isArray(data.sources) || data.sources.length > 100)
      throw Error('Grupo booleano inválido.');
    parsed[i].boolean = { operation: data.operation, operands: data.operands };
    parsed[i].booleanEmpty = data.empty === true;
    parsed.push(...data.sources.map((s: Shape) => G.normalize(s)));
  });
  if (!G.valid({ version: 1, shapes: parsed })) throw Error('Formas ou grupo booleano inválidos.');
  return parsed;
}
