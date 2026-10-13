(function (root) {
    const TYPES = ['rectangle', 'triangle', 'hexagon', 'diamond', 'custom', 'panel', 'tag'];
    function points(type, x = 200, y = 140, w = 400, h = 220) {
        if (type === 'triangle') return [[x + w / 2, y], [x + w, y + h], [x, y + h]];
        if (type === 'hexagon') return [[x + w / 4, y], [x + w * 3 / 4, y], [x + w, y + h / 2], [x + w * 3 / 4, y + h], [x + w / 4, y + h], [x, y + h / 2]];
        if (type === 'diamond') return [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]];
        return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    }
    function bevel(vertices, distance) {
        if (distance <= 0) return vertices.map(p => [...p]);
        return vertices.flatMap((p, i) => {
            const before = vertices[(i + vertices.length - 1) % vertices.length];
            const after = vertices[(i + 1) % vertices.length];
            const a = Math.hypot(before[0] - p[0], before[1] - p[1]);
            const b = Math.hypot(after[0] - p[0], after[1] - p[1]);
            const d = Math.min(distance, a / 2, b / 2);
            return [before, after].map((q, j) => p.map((n, axis) => round(n + (q[axis] - n) * d / ((j ? b : a) || 1))));
        });
    }
    const round = n => Math.round(n * 1000) / 1000;
    const escape = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[c]));
    const path = p => 'M ' + p.map(v => v.map(round).join(' ')).join(' L ') + ' Z';
    function normalize(s) { if (s.polygons) s.points = s.polygons[0][0]; return s; }
    function rings(s) { return s.polygons ? s.polygons.flatMap((polygon, p) => polygon.map((points, r) => ({p, r, points}))) : [{p: 0, r: 0, points: s.points}]; }
    function radiusPx(s) { const b = bounds(s); return (s.radius || 0) * (s.radiusUnit === '%' ? Math.min(b.width, b.height) / 100 : 1); }
    function corners(vertices, radius) {
        return vertices.map((p, i) => {
            const prev = vertices[(i + vertices.length - 1) % vertices.length], next = vertices[(i + 1) % vertices.length];
            const a = Math.hypot(prev[0]-p[0],prev[1]-p[1]), b = Math.hypot(next[0]-p[0],next[1]-p[1]);
            const u = p.map((n,j)=>(prev[j]-n)/(a||1)), v = p.map((n,j)=>(next[j]-n)/(b||1));
            const angle = Math.acos(Math.max(-1,Math.min(1,u[0]*v[0]+u[1]*v[1]))), tangent = Math.tan(angle/2);
            const value = Array.isArray(radius) ? radius[i] : radius;
            const d = a && b && tangent > 1e-6 && angle < Math.PI-1e-6 ? Math.min(value/tangent,a/2,b/2) : 0;
            const r = d*tangent, start = p.map((n,j)=>n+u[j]*d), end = p.map((n,j)=>n+v[j]*d);
            const center = p.map((n,j)=>n+(u[j]+v[j])*d/(1+Math.cos(angle)||1));
            const sweep = u[0]*v[1]-u[1]*v[0] < 0 ? 1 : 0;
            return {start,end,center,r,sweep};
        });
    }
    function roundedPath(vertices, radius) {
        if (!radius) return path(vertices);
        const cs = corners(vertices,radius), xy = p=>p.map(round).join(' ');
        return `M ${xy(cs[0].start)} ` + cs.map((c,i)=>`${i ? 'L '+xy(c.start)+' ' : ''}${c.r > 1e-6 ? `A ${round(c.r)} ${round(c.r)} 0 0 ${c.sweep} ${xy(c.end)}` : 'L '+xy(c.end)}`).join(' ') + ' Z';
    }
    function ringRadii(s, ring) { const b=bounds(s);return ring.points.map((_,i)=>{const c=s.cornerRadii?.[`${ring.p}:${ring.r}:${i}`];return c ? c.value*(c.unit==='%'?Math.min(b.width,b.height)/100:1) : radiusPx(s);}); }
    const shapePath = s => rings(s).map(r => roundedPath(r.points, s.cornerRadii ? ringRadii(s,r) : radiusPx(s))).join(' ');
    function sampledRing(vertices,radius) {
        if (!radius) return vertices;
        return corners(vertices,radius).flatMap(c=>{
            if(c.r<1e-6)return [c.start];
            const start=Math.atan2(c.start[1]-c.center[1],c.start[0]-c.center[0]);
            let delta=Math.atan2(c.end[1]-c.center[1],c.end[0]-c.center[0])-start;
            if(c.sweep && delta<0)delta+=Math.PI*2; if(!c.sweep && delta>0)delta-=Math.PI*2;
            const steps=Math.max(2,Math.ceil(Math.abs(delta)*Math.sqrt(c.r/0.15)));
            return Array.from({length:steps+1},(_,i)=>[c.center[0]+c.r*Math.cos(start+delta*i/steps),c.center[1]+c.r*Math.sin(start+delta*i/steps)]);
        });
    }
    function bounds(s) {
        const all = rings(s).flatMap(r => r.points), xs = all.map(p => p[0]), ys = all.map(p => p[1]);
        const x = Math.min(...xs), y = Math.min(...ys);
        return {x, y, width: round(Math.max(...xs) - x), height: round(Math.max(...ys) - y)};
    }
    function mapShape(s, fn) {
        if (s.polygons) { s.polygons = s.polygons.map(polygon => polygon.map(ring => ring.map(fn))); normalize(s); }
        else s.points = s.points.map(fn);
        if (s.basePoints) s.basePoints = s.basePoints.map(fn);
    }
    function resize(s, width, height) {
        const b = bounds(s);
        if (!(width > 0 && height > 0 && b.width > 0 && b.height > 0)) throw Error('A forma precisa de largura e altura positivas.');
        mapShape(s, p => [round(b.x + (p[0] - b.x) * width / b.width), round(b.y + (p[1] - b.y) * height / b.height)]);
        s.cut = 0; delete s.basePoints;
    }
    function moveEdges(s, keys, delta) {
        const moved = new Map();
        keys.forEach(key => { const [p,r,i] = key.split(':').map(Number), ring = rings(s).find(t => t.p === p && t.r === r); if (!ring || i < 0 || i >= ring.points.length) return;
            const indexes = moved.get(`${p}:${r}`) || new Set(); indexes.add(i); indexes.add((i + 1) % ring.points.length); moved.set(`${p}:${r}`, indexes);
        });
        rings(s).forEach(ring => { const indexes = moved.get(`${ring.p}:${ring.r}`); if (indexes) indexes.forEach(i => { ring.points[i] = ring.points[i].map((n, axis) => round(n + delta[axis])); }); });
        normalize(s); s.cut = 0; delete s.basePoints;
    }
    function clipping() { return root.polygonClipping || (typeof require !== 'undefined' && require('polygon-clipping')); }
    function cleanPolygons(polygons) { return polygons.map(polygon => polygon.map(ring => {
        const points = ring.map(p => p.map(round));
        if (points.length > 1 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1]) points.pop();
        return points;
    })); }
    function combine(op, shapes) {
        const inputs = shapes.map(s => (s.polygons || [[s.points]]).map((p,pi)=>p.map((r,ri)=>sampledRing(r,s.cornerRadii?ringRadii(s,{p:pi,r:ri,points:r}):radiusPx(s)))));
        return cleanPolygons(clipping()[op === 'flatten' ? 'union' : op](...inputs));
    }
    function svg(shapes) {
        const paths = shapes.map(s => [
            '    <path',
            `        id="${escape(s.id)}"`,
            `        aria-label="${escape(s.name)}"`,
            `        fill="${s.noFill ? 'none' : s.fill}"`,
            `        stroke="${s.stroke}"`,
            `        stroke-width="${s.strokeWidth}"`,
            `        stroke-linejoin="${s.join}"`,
            '        stroke-miterlimit="20"',
            '        fill-rule="evenodd"',
            `        opacity="${s.opacity / 100}"`,
            ...(s.radius || s.cornerRadii ? [`        data-corner-radius="${s.radius || 0}"`, `        data-radius-unit="${s.radiusUnit || 'px'}"`, `        data-vertices="${escape(JSON.stringify(s.polygons || [[s.points]]))}"`, ...(s.cornerRadii ? [`        data-corner-radii="${escape(JSON.stringify(s.cornerRadii))}"`] : [])] : []),
            '        d="',
            ...shapePath(s).match(/[MLAZ][^MLAZ]*/g).map(command=>'            '+command.trim()),
            '        "',
            '    />'
        ].join('\n'));
        return ['<svg', '    xmlns="http://www.w3.org/2000/svg"', '    width="800"', '    height="500"', '    viewBox="0 0 800 500"', '    preserveAspectRatio="xMidYMid meet"', '>', paths.join('\n\n'), '</svg>'].join('\n');
    }
    function valid(d) {
        const validPoints = list => Array.isArray(list) && list.length >= 3 && list.length <= 1000 &&
            list.every(p => Array.isArray(p) && p.length === 2 && p.every(n => Number.isFinite(n) && Math.abs(n) < 100000));
        return !!(d && d.version === 1 && Array.isArray(d.shapes) && d.shapes.length <= 100 &&
            new Set(d.shapes.map(s => s?.id)).size === d.shapes.length && d.shapes.every(s => s &&
                typeof s.id === 'string' && s.id.length <= 120 && typeof s.name === 'string' && s.name.length <= 80 && TYPES.includes(s.type) &&
                /^#[0-9a-f]{6}$/i.test(s.fill) && /^#[0-9a-f]{6}$/i.test(s.stroke) && ['miter', 'round', 'bevel'].includes(s.join) &&
                Number.isFinite(s.strokeWidth) && s.strokeWidth >= 0 && s.strokeWidth <= 30 && Number.isFinite(s.opacity) && s.opacity >= 0 && s.opacity <= 100 &&
                Number.isFinite(s.cut) && s.cut >= 0 && s.cut <= 80 && validPoints(s.points) &&
                (!s.polygons || (Array.isArray(s.polygons) && s.polygons.length > 0 && s.polygons.length <= 100 && s.polygons.every(p => Array.isArray(p) && p.length > 0 && p.length <= 100 && p.every(validPoints)) && rings(s).reduce((n,r) => n + r.points.length, 0) <= 1000)) &&
                (s.radius === undefined || (Number.isFinite(s.radius) && s.radius >= 0 && s.radius <= (s.radiusUnit === '%' ? 50 : 10000))) &&
                (s.radiusUnit === undefined || ['px','%'].includes(s.radiusUnit)) &&
                (!s.cornerRadii || (typeof s.cornerRadii==='object' && !Array.isArray(s.cornerRadii) && Object.entries(s.cornerRadii).every(([key,c])=>/^\d+:\d+:\d+$/.test(key) && c && ['px','%'].includes(c.unit) && Number.isFinite(c.value) && c.value>=0 && c.value<=(c.unit==='%'?50:10000)))) &&
                (!s.basePoints || validPoints(s.basePoints))));
    }
    // Normalize absolute/relative polygon commands without executing SVG markup.
    function parsePath(source, origin = [0, 0]) {
        const tokens = source.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || [];
        if (source.replace(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?|[\s,]/g, '')) throw Error('Coordenadas inválidas no path.');
        let i = 0, command = '', x = origin[0], y = origin[1], closed = false;
        const vertices = [];
        const number = () => {
            if (i >= tokens.length || /^[a-z]$/i.test(tokens[i])) throw Error('Faltam coordenadas no path.');
            const n = Number(tokens[i++]);
            if (!Number.isFinite(n) || Math.abs(n) >= 100000) throw Error('Coordenada fora do limite.');
            return n;
        };
        while (i < tokens.length) {
            if (/^[a-z]$/i.test(tokens[i])) command = tokens[i++];
            const op = command.toUpperCase(), relative = command !== op;
            if (!['M', 'L', 'H', 'V', 'Z'].includes(op)) throw Error('Para editar vértices, use M, L, H, V e Z. Curvas ainda não são suportadas.');
            if (closed) throw Error('Use um path separado para cada contorno.');
            if (op === 'Z') { closed = true; continue; }
            if (vertices.length === 0 && op !== 'M') throw Error('O path deve começar com M.');
            if (op === 'M' && vertices.length) throw Error('Use um path separado para cada contorno.');
            if (op === 'M' || op === 'L') { const nx = number(), ny = number(); x = nx + (relative ? x : 0); y = ny + (relative ? y : 0); }
            else if (op === 'H') x = number() + (relative ? x : 0);
            else y = number() + (relative ? y : 0);
            vertices.push([round(x), round(y)]);
            if (op === 'M') command = relative ? 'l' : 'L';
            if (vertices.length > 1000) throw Error('Limite de 1.000 vértices por forma.');
        }
        if (!closed || vertices.length < 3) throw Error('Feche a forma com Z e mantenha ao menos três vértices.');
        return vertices;
    }
    function parseContours(source) {
        const pieces = source.match(/[^zZ]+[zZ]/g) || [];
        if (!pieces.length || source.replace(/[^zZ]+[zZ]/g, '').trim()) throw Error('Feche cada contorno com Z.');
        let origin = [0,0];
        return pieces.map(piece => { const vertices = parsePath(piece, origin); origin = vertices[0]; return vertices; });
    }
    function fromContours(contours) {
        return contours.length === 1 ? [[contours[0]]] : cleanPolygons(clipping().xor(...contours.map(r => [r])));
    }
    function nearest(vertices, p) {
        let result = {distance: Infinity, index: 0, point: p};
        vertices.forEach((a, i) => {
            const b = vertices[(i + 1) % vertices.length], dx = b[0] - a[0], dy = b[1] - a[1];
            const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
            const q = [a[0] + t * dx, a[1] + t * dy], distance = Math.hypot(p[0] - q[0], p[1] - q[1]);
            if (distance < result.distance) result = {distance, index: i + 1, point: q};
        });
        return result;
    }
    const api = {points, bevel, round, path, shapePath, radiusPx, roundedPath, sampledRing, svg, valid, parsePath, parseContours, fromContours, nearest, normalize, rings, bounds, resize, mapShape, moveEdges, combine};
    if (typeof module !== 'undefined') module.exports = api; else root.Geometry = api;
})(globalThis);
