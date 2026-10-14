import * as G from '../domain/geometry';
import type { Shape, Ring, Point, GridSettings, View, RingReference } from '../domain/models';
import { element as $, formControl, setFormValue } from './dom';
const ns = 'http://www.w3.org/2000/svg';
export function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const e = document.createElementNS(ns, tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, String(String(v))));
  return e;
}
export interface RenderContext {
  shapes: Shape[];
  selected: string | null;
  vertex: number;
  selectedIds: Set<string>;
  selectedPoints: Set<string>;
  selectedSegments: Set<string>;
  selectedEdges: Set<string>;
  activeRing: {
    p: number;
    r: number;
  };
  background: 'light' | 'dark';
  view: View;
  grid: GridSettings;
  editingCode: boolean;
  codeInvalid: boolean;
  lastCodeGeometry: string;
  current(): Shape | undefined;
  currentPoints(): Ring;
  allSelectedPoints(): Set<string>;
  pointRef(key: string): {
    shape: Shape;
    ring: RingReference;
    i: number;
    point: Point;
  } | null;
  history: string[];
  future: string[];
  selectShape(id: string, multiple?: boolean): void;
  codeStatus(text: string, error?: boolean): void;
  partKey(id: string | null, p: number, r: number, i: number): string;
}
export function createRenderer(ctx: RenderContext) {
  function drawPartControls() {
    const partial = ctx.selectedPoints.size || ctx.selectedSegments.size,
      points = ctx.allSelectedPoints();
    ctx.shapes
      .filter((s) => ctx.selectedIds.has(s.id))
      .forEach((s) => {
        if (!partial && ctx.selectedIds.size !== 1) return;
        G.rings(s).forEach((ring) =>
          ring.points.forEach(([x, y], i) => {
            const key = ctx.partKey(s.id, ring.p, ring.r, i),
              marked = partial
                ? points.has(key)
                : s.id === ctx.selected &&
                  ring.p === ctx.activeRing.p &&
                  ring.r === ctx.activeRing.r &&
                  i === ctx.vertex;
            $('handles').append(
              el('circle', {
                cx: x,
                cy: y,
                r: 4 / ctx.view.z,
                'stroke-width': 1.5 / ctx.view.z,
                'data-shape': s.id,
                'data-point': i,
                'data-ring': `${ring.p}:${ring.r}`,
                class: 'handle' + (marked ? ' selected' : ''),
              }),
            );
          }),
        );
      });
    ctx.selectedSegments.forEach((key) => {
      const ref = ctx.pointRef(key);
      if (!ref) return;
      const a = ref.point,
        b = ref.ring.points[(ref.i + 1) % ref.ring.points.length];
      $('edgeHighlights').append(
        el('line', {
          x1: a[0],
          y1: a[1],
          x2: b[0],
          y2: b[1],
          class: 'selected-edge',
          'vector-effect': 'non-scaling-stroke',
        }),
      );
      const arrow = el('text', {
        x: (a[0] + b[0]) / 2,
        y: (a[1] + b[1]) / 2 - 8 / ctx.view.z,
        class: 'edge-arrow',
        'font-size': 15 / ctx.view.z,
      });
      arrow.textContent = '✥';
      $('edgeHighlights').append(arrow);
    });
    if (partial)
      $('count').textContent = ctx.selectedSegments.size
        ? `${ctx.selectedSegments.size} LINHA(S) · ${points.size} PONTOS`
        : `${ctx.selectedPoints.size} PONTOS SELECIONADOS`;
  }
  function camera() {
    $('camera').setAttribute(
      'transform',
      String(`translate(${ctx.view.x} ${ctx.view.y}) scale(${ctx.view.z})`),
    );
    $('zoom').textContent = Math.round(ctx.view.z * 100) + '%';
  }
  function syncGrid() {
    for (const id of ['pattern', 'dotPattern']) {
      const pattern = $(id);
      pattern.setAttribute('width', String(String(ctx.grid.cell)));
      pattern.setAttribute('height', String(String(ctx.grid.cell)));
      pattern.setAttribute('x', String(String(ctx.grid.originX)));
      pattern.setAttribute('y', String(String(ctx.grid.originY)));
    }
    $('pattern').firstElementChild!.setAttribute(
      'd',
      String(`M ${ctx.grid.cell} 0 H 0 V ${ctx.grid.cell}`),
    );
    $('gridRect').setAttribute(
      'fill',
      String(`url(#${ctx.grid.type === 'dots' ? 'dotPattern' : 'pattern'})`),
    );
    $('gridRect').style.display = ctx.grid.visible ? '' : 'none';
    $('grid').checked = ctx.grid.visible;
    $('magnet').classList.toggle('active', ctx.grid.magnet);
    $('magnet').setAttribute('aria-pressed', String(String(ctx.grid.magnet)));
    $('magnet').title =
      `Ímã ${ctx.grid.magnet ? 'ligado' : 'desligado'}: ${ctx.grid.stepX} × ${ctx.grid.stepY} px (M)`;
    setFormValue($('gridType'), String(ctx.grid.type));
    for (const [id, key] of Object.entries({
      cellSize: 'cell',
      stepX: 'stepX',
      stepY: 'stepY',
      originX: 'originX',
      originY: 'originY',
    } as const))
      setFormValue(formControl(id), String(String(ctx.grid[key])));
  }
  function render() {
    ctx.selectedEdges = new Set(
      [...ctx.selectedSegments]
        .filter((k) => JSON.parse(k)[0] === ctx.selected)
        .map((k) => JSON.parse(k).slice(1).join(':')),
    );
    const s = ctx.current();
    const single = !!s && ctx.selectedIds.size === 1;
    document.querySelector('.stage')!.classList.toggle('map-light', ctx.background === 'light');
    $('background').textContent = ctx.background === 'light' ? '☾ Fundo escuro' : '☀ Fundo claro';
    $('background').setAttribute('aria-pressed', String(String(ctx.background === 'light')));
    // Keep path elements stable between clicks so the browser recognizes dblclick.
    const old = new Map<string, SVGGElement>(
      [...$('shapes').children].map((node) => [
        (node as SVGGElement).dataset.id!,
        node as SVGGElement,
      ]),
    );
    ctx.shapes.forEach((item, index) => {
      let group = old.get(item.id);
      if (!group) {
        group = el('g', { 'data-id': item.id });
        group.append(el('path', { class: 'shape' }), el('path', { class: 'shape-hit' }));
      }
      old.delete(item.id);
      const [visible, hit] = group.children;
      for (const node of [visible, hit]) {
        node.setAttribute('d', String(G.shapePath(item)));
        node.setAttribute('data-id', String(item.id));
        node.setAttribute('fill-rule', String('evenodd'));
      }
      for (const [key, value] of Object.entries({
        fill: item.noFill ? 'none' : item.fill,
        stroke: item.stroke,
        'stroke-width': item.strokeWidth,
        'stroke-linejoin': item.join,
        'stroke-miterlimit': 20,
        opacity: item.opacity / 100,
      }))
        visible.setAttribute(key, String(value));
      hit.setAttribute('stroke-width', String(String(Math.max(item.strokeWidth, 14 / ctx.view.z))));
      // Do not reinsert existing nodes: native click/double-click targets remain stable.
      if ($('shapes').children[index] !== group)
        $('shapes').insertBefore(group, $('shapes').children[index] || null);
    });
    old.forEach((node) => node.remove());
    $('handles').replaceChildren();
    $('edgeHighlights').replaceChildren();
    if (single) {
      const b = G.bounds(s);
      [
        [b.x, b.y],
        [b.x + b.width, b.y],
        [b.x + b.width, b.y + b.height],
        [b.x, b.y + b.height],
      ].forEach((q, i) =>
        $('edgeHighlights').append(
          el('rect', {
            x: q[0] - 7 / ctx.view.z,
            y: q[1] - 7 / ctx.view.z,
            width: 14 / ctx.view.z,
            height: 14 / ctx.view.z,
            class: 'resize-handle',
            'pointer-events': 'stroke',
            'data-resize': i,
            fill: 'none',
            stroke: '#d99046',
            'stroke-width': 1 / ctx.view.z,
            style: 'cursor:' + (i % 2 ? 'nesw-resize' : 'nwse-resize'),
          }),
        ),
      );
    }
    if (ctx.selectedIds.size > 1)
      ctx.shapes
        .filter((item) => ctx.selectedIds.has(item.id))
        .forEach((item) =>
          $('edgeHighlights').append(
            el('path', {
              d: G.shapePath(item),
              class: 'selection-outline',
              'vector-effect': 'non-scaling-stroke',
            }),
          ),
        );
    const fields = [
      'name',
      'fill',
      'stroke',
      'strokeWidth',
      'opacity',
      'join',
      'cut',
      'radius',
      'radiusUnit',
      'noFill',
      'point',
      'px',
      'py',
      'shapeWidth',
      'shapeHeight',
      'lockRatio',
      'contour',
    ] as const;
    fields.forEach((id) => ($(id).disabled = !single));
    if (single) {
      if (!G.rings(s).some((t) => t.p === ctx.activeRing.p && t.r === ctx.activeRing.r))
        ctx.activeRing = { p: 0, r: 0 };
      const points = ctx.currentPoints();
      ctx.vertex = Math.max(0, Math.min(ctx.vertex, points.length - 1));
      $('title').textContent = s.name;
      const size = G.bounds(s);
      setFormValue($('shapeWidth'), String(size.width));
      setFormValue($('shapeHeight'), String(size.height));
      const corner = s.cornerRadii?.[`${ctx.activeRing.p}:${ctx.activeRing.r}:${ctx.vertex}`];
      setFormValue($('radius'), String(corner?.value ?? s.radius ?? 0));
      setFormValue($('radiusUnit'), String(corner?.unit || s.radiusUnit || 'px'));
      $('radius').max = String($('radiusUnit').value === '%' ? 50 : 10000);
      $('cut').disabled = !!s.polygons;
      $('contour').replaceChildren(
        ...G.rings(s).map(
          (ring, i) =>
            new Option('Contorno ' + (i + 1) + (ring.r ? ' (recorte)' : ''), `${ring.p}:${ring.r}`),
        ),
      );
      setFormValue($('contour'), String(`${ctx.activeRing.p}:${ctx.activeRing.r}`));
      (['name', 'fill', 'stroke', 'strokeWidth', 'opacity', 'join', 'cut'] as const).forEach((k) =>
        setFormValue($(k), String(s[k])),
      );
      $('noFill').checked = !!s.noFill;
      $('fillCode').textContent = s.fill;
      $('strokeCode').textContent = s.stroke;
      $('cutValue').textContent = s.cut + ' px';
      $('point').replaceChildren(
        ...points.map((p, i) => new Option('Ponto ' + (i + 1), String(i))),
      );
      setFormValue($('point'), String(ctx.vertex));
      setFormValue($('px'), String(points[ctx.vertex][0]));
      setFormValue($('py'), String(points[ctx.vertex][1]));
      $('count').textContent = ctx.selectedEdges.size
        ? ctx.selectedEdges.size + ' SEGMENTO(S)'
        : G.rings(s).reduce((n, r) => n + r.points.length, 0) + ' PONTOS';
    } else {
      $('title').textContent =
        ctx.selectedIds.size > 1
          ? ctx.selectedIds.size + ' formas selecionadas'
          : ctx.shapes.length
            ? 'Selecione uma forma'
            : 'Projeto vazio';
      (
        [
          'name',
          'strokeWidth',
          'opacity',
          'px',
          'py',
          'shapeWidth',
          'shapeHeight',
          'radius',
        ] as const
      ).forEach((id) => setFormValue($(id), String('')));
      $('contour').replaceChildren();
      $('point').replaceChildren();
      $('fillCode').textContent = '—';
      $('strokeCode').textContent = '—';
      $('cutValue').textContent = '—';
      setFormValue($('cut'), String(0));
      $('count').textContent = ctx.shapes.length + ' FORMAS';
    }
    $('emptyCanvas').hidden = ctx.shapes.length > 0;
    drawPartControls();
    $('layers').replaceChildren(
      ...[...ctx.shapes].reverse().map((item) => {
        const b = document.createElement('button');
        b.className = 'layer' + (ctx.selectedIds.has(item.id) ? ' active' : '');
        b.textContent = '◇  ' + item.name;
        b.onclick = (e) => {
          ctx.selectShape(item.id, e.shiftKey || e.ctrlKey || e.metaKey);
          render();
        };
        return b;
      }),
    );
    if (!ctx.shapes.length) {
      const p = document.createElement('p');
      p.textContent = 'Nenhuma forma no projeto.';
      p.className = 'empty-layers';
      $('layers').append(p);
    }
    $('undo').disabled = !ctx.history.length;
    $('redo').disabled = !ctx.future.length;
    (['duplicate', 'delete'] as const).forEach((id) => ($(id).disabled = !s));
    $('remove').disabled = !single || ctx.currentPoints().length <= 3;
    document
      .querySelectorAll<HTMLButtonElement>('[data-operation]')
      .forEach(
        (b) => (b.disabled = ctx.selectedIds.size < (b.dataset.operation === 'flatten' ? 1 : 2)),
      );
    syncGrid();
    camera();
    const geometry = G.svg(ctx.shapes);
    if (!$('dialog').hidden && !ctx.editingCode && geometry !== ctx.lastCodeGeometry) {
      setFormValue($('source'), String(geometry));
      ctx.codeInvalid = false;
      ctx.codeStatus('Código sincronizado com o mapa.');
      ctx.lastCodeGeometry = geometry;
    }
  }
  return { render, camera, syncGrid };
}
