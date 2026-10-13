const $ = id => document.getElementById(id);
const G = Geometry, ns = 'http://www.w3.org/2000/svg';
const names = {rectangle: 'Retângulo', triangle: 'Triângulo', hexagon: 'Hexágono', diamond: 'Losango'};
const make = type => ({id: crypto.randomUUID(), type, name: names[type], points: G.points(type), fill: '#222427', stroke: '#ff9b20', strokeWidth: 2, opacity: 100, join: 'miter', cut: 0, noFill: false});
let shapes = [make('rectangle')], selected = shapes[0].id, vertex = 0, history = [], future = [];
let selectedIds = new Set([selected]), selectedEdges = new Set(), activeRing = {p: 0, r: 0}, background = 'dark';
let selectedPoints = new Set(), selectedSegments = new Set();
let lastSelectedId = selected;
let view = {x: 0, y: 0, z: 1}, mode = 'select', space = false, drag = null;
let grid = {visible: true, magnet: true, type: 'lines', cell: 24, stepX: 1, stepY: 1, originX: 0, originY: 0};
let editingCode = false, codeTimer = null, codeInvalid = false, lastCodeGeometry = '';
let shiftHeld=false;window.addEventListener('keydown',e=>{shiftHeld=e.shiftKey;});window.addEventListener('keyup',e=>{shiftHeld=e.shiftKey;});window.addEventListener('blur',()=>{shiftHeld=false;});
let workspaceFiles={html:'',css:'',theme:'orange-night',autoRepair:true};
function restoreGrid(saved) {
    if (!saved || !['lines', 'dots'].includes(saved.type) || !['cell', 'stepX', 'stepY'].every(k => Number.isFinite(saved[k]) && saved[k] >= .1 && saved[k] <= 200) || !['originX', 'originY'].every(k => Number.isFinite(saved[k]) && Math.abs(saved[k]) <= 1000)) return;
    grid = {visible: saved.visible !== false, magnet: saved.magnet !== false, type: saved.type, cell: saved.cell, stepX: saved.stepX, stepY: saved.stepY, originX: saved.originX, originY: saved.originY};
}
try {
    const saved = JSON.parse(localStorage.getItem('svg-editor-project') || localStorage.getItem('scifi-project'));
    if (G.valid(saved)) { shapes = saved.shapes.map(G.normalize); selected = shapes.find(s=>s.id===saved.lastSelectedId)?.id || shapes[0]?.id || null; lastSelectedId=selected;selectedIds = new Set(selected ? [selected] : []); }
    if (saved?.background === 'light') background = 'light';
    restoreGrid(saved?.grid);
    if(saved?.workspace&&typeof saved.workspace.html==='string'&&typeof saved.workspace.css==='string'&&saved.workspace.html.length<2000000&&saved.workspace.css.length<2000000)workspaceFiles=saved.workspace;
} catch {}
document.querySelector('main').append($('dialog'));
const current = () => shapes.find(s => s.id === selected);
const currentPoints = () => G.rings(current()).find(t => t.p === activeRing.p && t.r === activeRing.r)?.points || current().points;
const state = () => JSON.stringify({shapes, selected, vertex, grid, background, lastSelectedId, selectedIds: [...selectedIds], selectedEdges: [...selectedEdges], selectedPoints:[...selectedPoints],selectedSegments:[...selectedSegments], activeRing});
const project = () => ({version: 1, shapes, grid, background, lastSelectedId,workspace:workspaceFiles});
const partKey = (id,p,r,i) => JSON.stringify([id,p,r,i]);
function clearParts() { selectedEdges = new Set(); selectedPoints.clear(); selectedSegments.clear(); }
function pointRef(key,list=shapes) { const [id,p,r,i]=JSON.parse(key),shape=list.find(s=>s.id===id),ring=shape&&G.rings(shape).find(t=>t.p===p&&t.r===r);return ring&&i>=0&&i<ring.points.length?{shape,ring,i,point:ring.points[i]}:null; }
function partialIds() {
    selectedIds=new Set([...selectedPoints,...selectedSegments].map(k=>JSON.parse(k)[0]));
    if(!selectedIds.has(selected))selected=[...selectedIds][0]||null;
    if(selected){lastSelectedId=selected;const key=[...selectedPoints,...selectedSegments].find(k=>JSON.parse(k)[0]===selected);if(key){const [,p,r,i]=JSON.parse(key);activeRing={p,r};vertex=i;}}
}
function allSelectedPoints() {
    const keys=new Set(selectedPoints);
    selectedSegments.forEach(key=>{const ref=pointRef(key);if(ref){const [id,p,r,i]=JSON.parse(key);keys.add(key);keys.add(partKey(id,p,r,(i+1)%ref.ring.points.length));}});
    return keys;
}
function moveParts(keys,delta,list=shapes) {
    const touched=new Set();keys.forEach(key=>{const ref=pointRef(key,list);if(ref){ref.ring.points[ref.i]=ref.point.map((n,axis)=>G.round(n+delta[axis]));touched.add(ref.shape);}});
    touched.forEach(s=>{G.normalize(s);dirty(s);});
}
function drawPartControls() {
    const partial=selectedPoints.size||selectedSegments.size,points=allSelectedPoints();
    shapes.filter(s=>selectedIds.has(s.id)).forEach(s=>{
        if(!partial&&selectedIds.size!==1)return;
        G.rings(s).forEach(ring=>ring.points.forEach(([x,y],i)=>{
            const key=partKey(s.id,ring.p,ring.r,i),marked=partial?points.has(key):s.id===selected&&ring.p===activeRing.p&&ring.r===activeRing.r&&i===vertex;
            $('handles').append(el('circle',{cx:x,cy:y,r:4/view.z,'stroke-width':1.5/view.z,'data-shape':s.id,'data-point':i,'data-ring':`${ring.p}:${ring.r}`,class:'handle'+(marked?' selected':'')}));
        }));
    });
    selectedSegments.forEach(key=>{const ref=pointRef(key);if(!ref)return;const a=ref.point,b=ref.ring.points[(ref.i+1)%ref.ring.points.length];$('edgeHighlights').append(el('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],class:'selected-edge','vector-effect':'non-scaling-stroke'}));const arrow=el('text',{x:(a[0]+b[0])/2,y:(a[1]+b[1])/2-8/view.z,class:'edge-arrow','font-size':15/view.z});arrow.textContent='✥';$('edgeHighlights').append(arrow);});
    if(partial)$('count').textContent=selectedSegments.size?`${selectedSegments.size} LINHA(S) · ${points.size} PONTOS`:`${selectedPoints.size} PONTOS SELECIONADOS`;
}
function selectShape(id, multiple = false) {
    if (multiple) { if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id); }
    else selectedIds = new Set([id]);
    selected = selectedIds.has(id) ? id : [...selectedIds].at(-1) || null;
    if(selected)lastSelectedId=selected;
    clearParts(); activeRing = {p: 0, r: 0}; vertex = 0;
    persist();
}
function clearSelection() { selected = null; selectedIds.clear(); clearParts(); activeRing = {p: 0, r: 0}; vertex = 0; }
function persist() {
    try { localStorage.setItem('svg-editor-project', JSON.stringify(project())); }
    catch { toast('Armazenamento local indisponível. Salve o projeto.'); }
}
function commit(before) {
    if (before !== state()) { history.push(before); if (history.length > 100) history.shift(); future = []; persist(); }
    render();
}
function change(fn) { const before = state(); fn(); commit(before); }
function restore(stack, other) {
    if (!stack.length) return;
    other.push(state());
    const d = JSON.parse(stack.pop());
    shapes = d.shapes.map(G.normalize); selected = d.selected; vertex = d.vertex; grid = d.grid; background = d.background || 'dark';lastSelectedId=d.lastSelectedId || selected;
    selectedIds = new Set(d.selectedIds || (selected ? [selected] : [])); selectedEdges = new Set(d.selectedEdges || []); activeRing = d.activeRing || {p:0,r:0};
    selectedPoints=new Set(d.selectedPoints||[]);selectedSegments=new Set(d.selectedSegments||[]);
    persist(); render();
}
function el(tag, attrs) {
    const e = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
}
function camera() {
    $('camera').setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.z})`);
    $('zoom').textContent = Math.round(view.z * 100) + '%';
}
function syncGrid() {
    for (const id of ['pattern', 'dotPattern']) {
        const pattern = $(id);
        pattern.setAttribute('width', grid.cell); pattern.setAttribute('height', grid.cell);
        pattern.setAttribute('x', grid.originX); pattern.setAttribute('y', grid.originY);
    }
    $('pattern').firstElementChild.setAttribute('d', `M ${grid.cell} 0 H 0 V ${grid.cell}`);
    $('gridRect').setAttribute('fill', `url(#${grid.type === 'dots' ? 'dotPattern' : 'pattern'})`);
    $('gridRect').style.display = grid.visible ? '' : 'none';
    $('grid').checked = grid.visible;
    $('magnet').classList.toggle('active', grid.magnet);
    $('magnet').setAttribute('aria-pressed', String(grid.magnet));
    $('magnet').title = `Ímã ${grid.magnet ? 'ligado' : 'desligado'}: ${grid.stepX} × ${grid.stepY} px (M)`;
    $('gridType').value = grid.type;
    for (const [id, key] of Object.entries({cellSize: 'cell', stepX: 'stepX', stepY: 'stepY', originX: 'originX', originY: 'originY'})) $(id).value = grid[key];
}
function render() {
    selectedEdges=new Set([...selectedSegments].filter(k=>JSON.parse(k)[0]===selected).map(k=>JSON.parse(k).slice(1).join(':')));
    const s = current();
    const single = !!s && selectedIds.size === 1;
    document.querySelector('.stage').classList.toggle('map-light', background === 'light');
    $('background').textContent = background === 'light' ? '☾ Fundo escuro' : '☀ Fundo claro';
    $('background').setAttribute('aria-pressed', String(background === 'light'));
    // Keep path elements stable between clicks so the browser recognizes dblclick.
    const old = new Map([...$('shapes').children].map(node => [node.dataset.id, node]));
    shapes.forEach((item, index) => {
        let group = old.get(item.id);
        if (!group) { group = el('g', {'data-id': item.id}); group.append(el('path', {class: 'shape'}), el('path', {class: 'shape-hit'})); }
        old.delete(item.id);
        const [visible, hit] = group.children;
        for (const node of [visible, hit]) { node.setAttribute('d', G.shapePath(item)); node.setAttribute('data-id', item.id); node.setAttribute('fill-rule', 'evenodd'); }
        for (const [key, value] of Object.entries({fill: item.noFill ? 'none' : item.fill, stroke: item.stroke, 'stroke-width': item.strokeWidth, 'stroke-linejoin': item.join, 'stroke-miterlimit':20, opacity: item.opacity / 100})) visible.setAttribute(key, value);
        hit.setAttribute('stroke-width', Math.max(item.strokeWidth, 14 / view.z));
        // Do not reinsert existing nodes: native click/double-click targets remain stable.
        if ($('shapes').children[index] !== group) $('shapes').insertBefore(group, $('shapes').children[index] || null);
    });
    old.forEach(node => node.remove());
    $('handles').replaceChildren();
    $('edgeHighlights').replaceChildren();
    if(single){const b=G.bounds(s);[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]].forEach((q,i)=>$('edgeHighlights').append(el('rect',{x:q[0]-7/view.z,y:q[1]-7/view.z,width:14/view.z,height:14/view.z,class:'resize-handle','pointer-events':'stroke','data-resize':i,fill:'none',stroke:'#d99046','stroke-width':1/view.z,style:'cursor:'+(i%2?'nesw-resize':'nwse-resize')})));}


    if (selectedIds.size > 1) shapes.filter(item => selectedIds.has(item.id)).forEach(item => $('edgeHighlights').append(el('path', {d: G.shapePath(item), class: 'selection-outline', 'vector-effect': 'non-scaling-stroke'})));
    const fields = ['name', 'fill', 'stroke', 'strokeWidth', 'opacity', 'join', 'cut', 'radius', 'radiusUnit', 'noFill', 'point', 'px', 'py', 'shapeWidth', 'shapeHeight', 'lockRatio', 'contour'];
    fields.forEach(id => $(id).disabled = !single);
    if (single) {
        if (!G.rings(s).some(t => t.p === activeRing.p && t.r === activeRing.r)) activeRing = {p:0,r:0};
        const points = currentPoints(); vertex = Math.max(0, Math.min(vertex, points.length - 1));
        $('title').textContent = s.name;
        const size = G.bounds(s); $('shapeWidth').value = size.width; $('shapeHeight').value = size.height;
        const corner=s.cornerRadii?.[`${activeRing.p}:${activeRing.r}:${vertex}`]; $('radius').value = corner?.value ?? s.radius ?? 0; $('radiusUnit').value = corner?.unit || s.radiusUnit || 'px'; $('radius').max = $('radiusUnit').value === '%' ? 50 : 10000;
        $('cut').disabled = !!s.polygons;
        $('contour').replaceChildren(...G.rings(s).map((ring,i) => new Option('Contorno '+(i+1)+(ring.r?' (recorte)':''),`${ring.p}:${ring.r}`)));
        $('contour').value = `${activeRing.p}:${activeRing.r}`;
        ['name', 'fill', 'stroke', 'strokeWidth', 'opacity', 'join', 'cut'].forEach(k => $(k).value = s[k]);
        $('noFill').checked = s.noFill; $('fillCode').textContent = s.fill; $('strokeCode').textContent = s.stroke;
        $('cutValue').textContent = s.cut + ' px';
        $('point').replaceChildren(...points.map((p, i) => new Option('Ponto ' + (i + 1), i)));
        $('point').value = vertex; $('px').value = points[vertex][0]; $('py').value = points[vertex][1];
        $('count').textContent = selectedEdges.size ? selectedEdges.size + ' SEGMENTO(S)' : G.rings(s).reduce((n,r)=>n+r.points.length,0) + ' PONTOS';
    } else {
        $('title').textContent = selectedIds.size > 1 ? selectedIds.size + ' formas selecionadas' : shapes.length ? 'Selecione uma forma' : 'Projeto vazio';
        ['name', 'strokeWidth', 'opacity', 'px', 'py', 'shapeWidth', 'shapeHeight', 'radius'].forEach(id => $(id).value = '');
        $('contour').replaceChildren();
        $('point').replaceChildren(); $('fillCode').textContent = '—'; $('strokeCode').textContent = '—'; $('cutValue').textContent = '—'; $('cut').value = 0;
        $('count').textContent = shapes.length + ' FORMAS';
    }
    $('emptyCanvas').hidden = shapes.length > 0;
    drawPartControls();
    $('layers').replaceChildren(...[...shapes].reverse().map(item => {
        const b = document.createElement('button'); b.className = 'layer' + (selectedIds.has(item.id) ? ' active' : ''); b.textContent = '◇  ' + item.name;
        b.onclick = e => { selectShape(item.id,e.shiftKey||e.ctrlKey||e.metaKey); render(); }; return b;
    }));
    if (!shapes.length) { const p = document.createElement('p'); p.textContent = 'Nenhuma forma no projeto.'; p.className = 'empty-layers'; $('layers').append(p); }
    $('undo').disabled = !history.length; $('redo').disabled = !future.length;
    ['duplicate', 'delete'].forEach(id => $(id).disabled = !s);
    $('remove').disabled = !single || currentPoints().length <= 3;
    document.querySelectorAll('[data-operation]').forEach(b => b.disabled = selectedIds.size < (b.dataset.operation === 'flatten' ? 1 : 2));
    syncGrid(); camera();
    const geometry = G.svg(shapes);
    if (!$('dialog').hidden && !editingCode && geometry !== lastCodeGeometry) { $('source').value = geometry; codeInvalid = false; codeStatus('Código sincronizado com o mapa.'); lastCodeGeometry = geometry; }
}
function fit() {
    const r = $('canvas').getBoundingClientRect();
    view.z = Math.max(.15, Math.min(1.5, (r.width - 80) / 800, (r.height - 100) / 500));
    view.x = (r.width - 800 * view.z) / 2; view.y = (r.height - 500 * view.z) / 2; render();
}
function local(e) { const r = $('canvas').getBoundingClientRect(); return [(e.clientX - r.left - view.x) / view.z, (e.clientY - r.top - view.y) / view.z]; }
function snap(n, axis) { const step = axis ? grid.stepY : grid.stepX, origin = axis ? grid.originY : grid.originX; return G.round(grid.magnet ? origin + Math.round((n - origin) / step) * step : n); }
function shiftCornerIndexes(s,p,r,index,remove){if(!s.cornerRadii)return;const next={};Object.entries(s.cornerRadii).forEach(([key,value])=>{let [a,b,i]=key.split(':').map(Number);if(a===p&&b===r){if(remove&&i===index)return;if(i>=index)i+=remove?-1:1;}next[[a,b,i].join(':')]=value;});s.cornerRadii=next;}
function dirty(s) { delete s.basePoints; s.cut = 0; s.type = 'custom'; }
function setCornerRadius(convert=false){change(()=>{const unit=$('radiusUnit').value,n=Number($('radius').value);if(!Number.isFinite(n))return;const keys=allSelectedPoints().size?allSelectedPoints():new Set(current()?[partKey(selected,activeRing.p,activeRing.r,vertex)]:[]);keys.forEach(key=>{const ref=pointRef(key);if(!ref)return;const s=ref.shape,k=JSON.parse(key).slice(1).join(':'),old=s.cornerRadii?.[k]||{value:s.radius||0,unit:s.radiusUnit||'px'},b=G.bounds(s),factor=Math.min(b.width,b.height)/100||1;const value=convert?old.value*(old.unit==='%'?factor:1)/(unit==='%'?factor:1):n;s.cornerRadii||={};s.cornerRadii[k]={value:G.round(Math.max(0,Math.min(unit==='%'?50:10000,value))),unit};});});}
$('radius').onchange=()=>setCornerRadius();$('radiusUnit').onchange=()=>setCornerRadius(true);
document.querySelectorAll('[data-type]').forEach(b => b.onclick = () => change(() => {
    if (shapes.length >= 100) return toast('Limite de 100 formas.');
    const s = make(b.dataset.type); shapes.push(s); selectShape(s.id);
}));
['name', 'fill', 'stroke', 'strokeWidth', 'opacity', 'join', 'noFill'].forEach(k => $(k).onchange = () => change(() => {
    const s = current(); if (!s) return;
    let v = k === 'noFill' ? $(k).checked : $(k).value;
    if (['opacity', 'strokeWidth'].includes(k)) v = Math.max(0, Math.min(k === 'opacity' ? 100 : 30, Number(v) || 0));
    s[k] = v;
}));
$('cut').onchange = () => change(() => {
    const s = current(); if (!s) return;
    if ((s.basePoints || s.points).length > 500 && +$('cut').value > 0) { toast('O recorte excederia o limite de 1.000 vértices.'); return; }
    s.basePoints ||= structuredClone(s.points); s.cut = +$('cut').value;
    s.points = G.bevel(s.basePoints, s.cut); delete s.cornerRadii; vertex = 0;clearParts();
});
$('point').onchange = () => { vertex = +$('point').value; clearParts(); render(); };
$('contour').onchange = () => { const [p,r] = $('contour').value.split(':').map(Number); activeRing={p,r}; vertex=0; clearParts(); render(); };
['shapeWidth','shapeHeight'].forEach(id => $(id).onchange = () => change(() => {
    const s=current(); if(!s)return; const b=G.bounds(s), n=Number($(id).value); if(!Number.isFinite(n)||n<1||n>10000)return;
    let w=id==='shapeWidth'?n:b.width,h=id==='shapeHeight'?n:b.height;
    if($('lockRatio').checked || shiftHeld) { if(id==='shapeWidth') h=G.round(b.height*n/b.width); else w=G.round(b.width*n/b.height); }
    if(w<1||h<1||w>10000||h>10000)return toast('Dimensões devem ficar entre 1 e 10.000 px.');
    G.resize(s,w,h); clearParts();
}));
['px', 'py'].forEach((id, axis) => $(id).onchange = () => change(() => {
    const s = current(), n = Number($(id).value);
    if (s && Number.isFinite(n) && Math.abs(n) < 100000) { currentPoints()[vertex][axis] = n; dirty(s); }
}));
$('remove').onclick = () => change(() => { const s = current(); if (s && currentPoints().length > 3) { shiftCornerIndexes(s,activeRing.p,activeRing.r,vertex,true);currentPoints().splice(vertex, 1); clearParts(); dirty(s); } });
$('duplicate').onclick = () => change(() => {
    if (!current() || shapes.length + selectedIds.size > 100) return;
    const copies=shapes.filter(s=>selectedIds.has(s.id)).map(item=>{const s=G.normalize(structuredClone(item));s.id=crypto.randomUUID();s.name=(s.name+' cópia').slice(0,80);G.mapShape(s,p=>p.map(n=>n+24));return s;});
    shapes.push(...copies); selectShape(copies.at(-1).id);selectedIds=new Set(copies.map(s=>s.id));
});
$('delete').onclick = () => change(() => { shapes = shapes.filter(s => !selectedIds.has(s.id)); clearSelection(); });
$('undo').onclick = () => restore(history, future); $('redo').onclick = () => restore(future, history);
function tool(v) { mode = v; $('select').classList.toggle('active', v === 'select'); $('lineSelect').classList.toggle('active',v==='lines');$('hand').classList.toggle('active', v === 'hand'); $('canvas').style.cursor = v === 'hand' ? 'grab' : 'default'; }
$('select').onclick = () => tool('select'); $('hand').onclick = () => tool('hand');
$('lineSelect').onclick=()=>tool('lines');
function nearestRing(s,p) { let best=null; G.rings(s).forEach(ring=>{const edge=G.nearest(ring.points,p);if(!best||edge.distance<best.distance)best={...edge,p:ring.p,r:ring.r,points:ring.points};}); return best; }
$('canvas').onpointerdown = e => {
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault(); const p=local(e),add=e.shiftKey||e.ctrlKey||e.metaKey;
    if(mode==='hand'||space||e.button===1)drag={kind:'pan',start:[e.clientX,e.clientY],view:{...view}};
    else if(e.target.hasAttribute('data-resize') && current()){const saved=G.normalize(structuredClone(current()));drag={kind:'resize',corner:+e.target.dataset.resize,start:p,shapes:[saved],before:state()};}
    else if(e.target.hasAttribute('data-point')) {
        const id=e.target.dataset.shape,[rp,rr]=e.target.dataset.ring.split(':').map(Number),i=+e.target.dataset.point,key=partKey(id,rp,rr,i),was=allSelectedPoints().has(key);
        if(!was){if(!add)clearParts();selectedPoints.add(key);}
        selected=id;activeRing={p:rp,r:rr};vertex=i;partialIds();
        drag={kind:'parts',start:p,anchor:key,keys:[...allSelectedPoints()],shapes:shapes.filter(s=>selectedIds.has(s.id)).map(s=>G.normalize(structuredClone(s))),before:state(),toggle:add&&was?{kind:'point',key}:null};
    } else if(e.target.hasAttribute('data-id')) {
        const id=e.target.dataset.id,target=shapes.find(s=>s.id===id),edge=nearestRing(target,p);
        if(!e.altKey&&edge.distance<=Math.max(9/view.z,target.strokeWidth/2)) {
            const key=partKey(id,edge.p,edge.r,edge.index-1),was=selectedSegments.has(key),extend=add||mode==='lines';
            if(selectedPoints.size>1&&selectedIds.has(id)&&!add){
                const keys=[...allSelectedPoints()],anchor=keys.find(k=>JSON.parse(k)[0]===id)||keys[0];
                selected=id;partialIds();drag={kind:'parts',start:p,anchor,keys,shapes:shapes.filter(s=>selectedIds.has(s.id)).map(s=>G.normalize(structuredClone(s))),before:state()};
            }else{
            const endpoints=allSelectedPoints(),nextKey=partKey(id,edge.p,edge.r,edge.index%edge.points.length),insideSelection=endpoints.has(key)&&endpoints.has(nextKey);
            if(!was){if(!extend&&!insideSelection)clearParts();selectedSegments.add(key);}
            selected=id;activeRing={p:edge.p,r:edge.r};vertex=edge.index-1;partialIds();
            drag={kind:'parts',start:p,anchor:key,keys:[...allSelectedPoints()],shapes:shapes.filter(s=>selectedIds.has(s.id)).map(s=>G.normalize(structuredClone(s))),before:state(),toggle:extend&&was?{kind:'segment',key}:null};
            }
        } else {
            if(!add&&!e.altKey&&selectedPoints.size>1&&selectedIds.has(id)){
                const keys=[...allSelectedPoints()],anchor=keys.find(k=>JSON.parse(k)[0]===id)||keys[0];
                drag={kind:'parts',start:p,anchor,keys,shapes:shapes.filter(s=>selectedIds.has(s.id)).map(s=>G.normalize(structuredClone(s))),before:state()};
            }else{
            if(add)selectShape(id,true);else if(!selectedIds.has(id)||selectedPoints.size||selectedSegments.size)selectShape(id);
            if(!selectedIds.has(id)){render();return;}
            clearParts();drag={kind:'shape',start:p,shapes:shapes.filter(s=>selectedIds.has(s.id)).map(s=>G.normalize(structuredClone(s))),before:state()};
            }
        }
    } else {
        drag={kind:'marquee',start:p,add,initial:[...(add?allSelectedPoints():[])],original:{selected,lastSelectedId,selectedIds:[...selectedIds],selectedPoints:[...selectedPoints],selectedSegments:[...selectedSegments],activeRing:{...activeRing},vertex}};
    }
    drag.pointer=e.pointerId;drag.screen=[e.clientX,e.clientY];drag.moved=false;render();
};
function marqueeSelection(p) {
    const x=Math.min(drag.start[0],p[0]),y=Math.min(drag.start[1],p[1]),width=Math.abs(p[0]-drag.start[0]),height=Math.abs(p[1]-drag.start[1]);
    $('marquee').replaceChildren(el('rect',{x,y,width,height,class:'marquee-box','vector-effect':'non-scaling-stroke'}));
    selectedPoints=new Set(drag.initial);selectedSegments.clear();
    shapes.forEach(s=>G.rings(s).forEach(ring=>ring.points.forEach(([px,py],i)=>{if(px>=x&&px<=x+width&&py>=y&&py<=y+height)selectedPoints.add(partKey(s.id,ring.p,ring.r,i));})));
    partialIds();render();
}
$('canvas').onpointermove = e => {
    const p=local(e);$('coords').textContent=`X ${G.round(p[0])} · Y ${G.round(p[1])}`;
    if(!drag){if(mode==='hand'||space)return;if(e.target.hasAttribute('data-id')){const s=shapes.find(s=>s.id===e.target.dataset.id);if(s)e.target.style.cursor='move';}return;}
    if(!drag.moved&&Math.hypot(e.clientX-drag.screen[0],e.clientY-drag.screen[1])<3)return;
    if(!drag.moved){drag.moved=true;$('canvas').setPointerCapture(e.pointerId);}
    if(drag.kind==='marquee'){marqueeSelection(p);return;}
    if(drag.kind==='pan'){view.x=drag.view.x+e.clientX-drag.start[0];view.y=drag.view.y+e.clientY-drag.start[1];}
    else if(drag.kind==='resize'){
        const saved=drag.shapes[0],b=G.bounds(saved),i=drag.corner,ax=i===0||i===3?b.x+b.width:b.x,ay=i<2?b.y+b.height:b.y;
        let w=Math.max(1,Math.abs(snap(p[0],0)-ax)),h=Math.max(1,Math.abs(snap(p[1],1)-ay));
        if(e.shiftKey||$('lockRatio').checked){const scale=Math.max(w/b.width,h/b.height);w=b.width*scale;h=b.height*scale;}
        if(w<=10000&&h<=10000){const next=G.normalize(structuredClone(saved));G.resize(next,w,h);const dx=(i===0||i===3?ax-w:ax)-b.x,dy=(i<2?ay-h:ay)-b.y;G.mapShape(next,q=>[G.round(q[0]+dx),G.round(q[1]+dy)]);shapes[shapes.findIndex(s=>s.id===next.id)]=next;}
    } else if(drag.kind==='parts'){


        const anchor=pointRef(drag.anchor,drag.shapes).point,delta=p.map((n,axis)=>snap(anchor[axis]+n-drag.start[axis],axis)-anchor[axis]);
        const next=drag.shapes.map(s=>G.normalize(structuredClone(s)));moveParts(new Set(drag.keys),delta,next);
        next.forEach(s=>shapes[shapes.findIndex(item=>item.id===s.id)]=s);
    } else {
        const anchor=drag.shapes[0].points[0],delta=p.map((n,axis)=>snap(anchor[axis]+n-drag.start[axis],axis)-anchor[axis]);
        drag.shapes.forEach(saved=>{const next=G.normalize(structuredClone(saved));G.mapShape(next,q=>q.map((n,axis)=>G.round(n+delta[axis])));shapes[shapes.findIndex(s=>s.id===next.id)]=next;});
    }
    render();
};
function end(e) {
    if(!drag)return;const d=drag;drag=null;
    if($('canvas').hasPointerCapture(d.pointer))$('canvas').releasePointerCapture(d.pointer);
    $('marquee').replaceChildren();
    if(d.kind==='marquee'){
        if(e?.type==='pointercancel'){selected=d.original.selected;lastSelectedId=d.original.lastSelectedId;selectedIds=new Set(d.original.selectedIds);selectedPoints=new Set(d.original.selectedPoints);selectedSegments=new Set(d.original.selectedSegments);activeRing=d.original.activeRing;vertex=d.original.vertex;}
        else if(!d.moved&&!d.add)clearSelection();
        persist();render();return;
    }
    if(e?.type==='pointercancel') {if(d.shapes)d.shapes.forEach(s=>shapes[shapes.findIndex(item=>item.id===s.id)]=G.normalize(structuredClone(s)));if(d.kind==='pan')view={...d.view};persist();render();return;}
    if(d.moved&&d.before)commit(d.before);
    else if(d.toggle){(d.toggle.kind==='point'?selectedPoints:selectedSegments).delete(d.toggle.key);partialIds();render();}
    else render();
}
window.addEventListener('pointerup',end);$('canvas').onpointercancel=end;

$('canvas').ondblclick = e => {
    if (mode === 'hand' || space) return;
    const p = local(e);
    let target = null, edge = null;
    // Geometric hit testing works on thin strokes and no-fill shapes, even if a click target changes.
    for (const s of [...shapes].reverse()) { const hit = nearestRing(s, p); if (hit.distance <= Math.max(9 / view.z, s.strokeWidth / 2)) { target = s; edge = hit; break; } }
    if (!target || G.rings(target).reduce((n,r)=>n+r.points.length,0) >= 1000) return;
    change(() => { selectShape(target.id); activeRing={p:edge.p,r:edge.r};shiftCornerIndexes(target,edge.p,edge.r,edge.index,false);edge.points.splice(edge.index,0,edge.point.map(snap));vertex=edge.index;dirty(target); });
};
function zoom(f, cx, cy) {
    const r = $('canvas').getBoundingClientRect(); cx ??= r.width / 2; cy ??= r.height / 2;
    const z = Math.max(.15, Math.min(4, view.z * f));
    view.x = cx - (cx - view.x) * z / view.z; view.y = cy - (cy - view.y) * z / view.z; view.z = z; render();
}
$('canvas').addEventListener('wheel', e => {
    e.preventDefault(); if (e.ctrlKey) { const r = $('canvas').getBoundingClientRect(); zoom(Math.exp(-e.deltaY * .002), e.clientX - r.left, e.clientY - r.top); }
    else { view.x -= e.deltaX; view.y -= e.deltaY; camera(); }
}, {passive: false});
$('plus').onclick = () => zoom(1.2); $('minus').onclick = () => zoom(1 / 1.2); $('fit').onclick = fit;
$('grid').onchange = () => change(() => grid.visible = $('grid').checked);
$('background').onclick = () => change(() => background = background === 'dark' ? 'light' : 'dark');
function combineShapes(op) {
    if(selectedIds.size<(op==='flatten'?1:2))return;
    try {
        const operands=shapes.filter(s=>selectedIds.has(s.id)),result=G.combine(op,operands),label={union:'União',difference:'Subtração',intersection:'Interseção',xor:'Exclusão',flatten:'Caminho achatado'}[op];
        const merged=result.length?G.normalize({...structuredClone(operands[0]),id:crypto.randomUUID(),name:label,type:'custom',cut:0,radius:0,cornerRadii:undefined,polygons:result,points:result[0][0]}):null;
        if(merged){delete merged.basePoints;if(!G.valid({version:1,shapes:[merged]}))throw Error('O resultado excedeu o limite de vértices.');}
        change(()=>{const last=shapes.findIndex(s=>s.id===operands.at(-1).id);const next=[];shapes.forEach((s,i)=>{if(!selectedIds.has(s.id))next.push(s);if(i===last&&merged)next.push(merged);});shapes=next;clearSelection();if(merged)selectShape(merged.id);});
        if(!merged)toast('A operação não gerou área. As formas selecionadas foram removidas; use Desfazer para restaurar.');
    }catch(e){toast('Não foi possível combinar: '+e.message);}
    $('booleanOptions').hidden=true;$('booleanMenu').setAttribute('aria-expanded','false');
}
$('booleanMenu').onclick=()=>{const open=$('booleanOptions').hidden;$('booleanOptions').hidden=!open;$('booleanMenu').setAttribute('aria-expanded',String(open));};
document.querySelectorAll('[data-operation]').forEach(b=>b.onclick=()=>combineShapes(b.dataset.operation));
document.addEventListener('click',e=>{if(!e.target.closest('.boolean-control')){$('booleanOptions').hidden=true;$('booleanMenu').setAttribute('aria-expanded','false');}});
$('magnet').onclick = () => change(() => grid.magnet = !grid.magnet);
$('gridSettings').onclick = () => $('gridDialog').showModal(); $('closeGrid').onclick = () => $('gridDialog').close();
$('gridType').onchange = () => change(() => grid.type = $('gridType').value);
for (const [id, key] of Object.entries({cellSize: 'cell', stepX: 'stepX', stepY: 'stepY', originX: 'originX', originY: 'originY'})) $(id).onchange = () => change(() => {
    const origin = key.startsWith('origin'), n = Number($(id).value);
    if (Number.isFinite(n)) grid[key] = Math.max(origin ? -1000 : .1, Math.min(origin ? 1000 : 200, n));
});
for (const [id, factor] of [['stepCell', 1], ['stepHalf', .5], ['stepPixel', 0]]) $(id).onclick = () => change(() => { grid.stepX = grid.stepY = factor ? grid.cell * factor : 1; });
function toast(msg) { $('toast').textContent = msg; $('toast').classList.add('visible'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').classList.remove('visible'), 3500); }
function download(text, name, type) { const url = URL.createObjectURL(new Blob([text], {type})), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
function canSave() { if (codeTimer && !$('dialog').hidden) applyCode(); if (codeInvalid && !$('dialog').hidden) { toast('Corrija o código antes de salvar ou exportar.'); return false; } if (!shapes.length) { toast('Adicione ao menos uma forma para salvar ou exportar.'); return false; } return true; }
$('export').onclick = () => { if (!canSave()) return; download(G.svg(shapes), 'svg-design.svg', 'image/svg+xml'); toast('SVG exportado com fundo transparente.'); };
$('save').onclick = () => { if (!canSave()) return; download(JSON.stringify(project(), null, 2), 'svg-projeto.json', 'application/json'); toast('Projeto salvo.'); };
$('open').onclick = () => $('file').click();
$('file').onchange = async () => {
    try {
        const f = $('file').files[0]; if (!f) return; if (f.size > 2000000) throw Error();
        const d = JSON.parse(await f.text()); if (!G.valid(d)) throw Error();
        change(() => { shapes = d.shapes.map(G.normalize); clearSelection();lastSelectedId=null; const first=shapes.find(s=>s.id===d.lastSelectedId)||shapes[0];if(first)selectShape(first.id); restoreGrid(d.grid);background=d.background==='light'?'light':'dark';if(d.workspace&&typeof d.workspace.html==='string'&&typeof d.workspace.css==='string'&&d.workspace.html.length<2000000&&d.workspace.css.length<2000000)workspaceFiles=d.workspace;else workspaceFiles={html:'',css:'',theme:workspaceFiles.theme,autoRepair:workspaceFiles.autoRepair}; });window.CodeWorkbench?.loadWorkspace(workspaceFiles);fit(); toast('Projeto aberto.');
    } catch { toast('Projeto inválido. Escolha um JSON do editor.'); } finally { $('file').value = ''; }
};
function codeStatus(text, error = false) { $('codeStatus').textContent = text; $('codeStatus').classList.toggle('error', error);window.dispatchEvent(new CustomEvent('vector-code-status',{detail:{text,error}})); }
function color(value, fallback) {
    if (!value) return fallback;
    if (!/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value)) throw Error('Use cores hexadecimais (#RGB ou #RRGGBB) ou fill="none".');
    return value.length === 4 ? '#' + [...value.slice(1)].map(c => c + c).join('') : value;
}
function parseCode(text) {
    if (text.length > 2000000) throw Error('Código muito grande.');
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) {const text=doc.querySelector('parsererror').textContent;const at=text.match(/line (\d+).*column (\d+)/i);throw Object.assign(Error('SVG incompleto ou XML inválido. Confira aspas e fechamento das tags.'),{line:at?Number(at[1]):1});}
    const svg = doc.documentElement.localName === 'svg' ? doc.documentElement : doc.querySelector('svg');
    if (!svg) throw Error('Inclua um elemento <svg>.');
    const box = svg.getAttribute('viewBox');
    if (box && box.trim().split(/[\s,]+/).map(Number).join(' ') !== '0 0 800 500') throw Error('A prancheta usa viewBox="0 0 800 500". Ajuste as coordenadas dos pontos no path.');
    const children = [...svg.children].filter(n => !['title', 'desc'].includes(n.localName));
    if (children.length > 100) throw Error('Limite de 100 formas.');
    return children.map((node, i) => {
        if (!['path', 'polygon', 'rect'].includes(node.localName)) throw Error('Use path, polygon ou rect. Grupos, curvas e outros elementos ainda não são suportados.');
        const typo=[...node.attributes].find(a=>['stoke','stroke-wdith','stroke-witdh'].includes(a.name));if(typo)throw Error(`Atributo ${typo.name} inválido. Use stroke ou stroke-width.`);
        if ([...node.attributes].some(a => a.name.startsWith('on') || ['transform', 'style'].includes(a.name))) throw Error('Use atributos diretos de cor e coordenadas, sem style, transform ou eventos.');
        const old = shapes.find(s => s.id === node.getAttribute('id')) || shapes[i];
        let pts,polygons, radius=0, radiusUnit='px', cornerRadii, regeneratePath=false;
        if (node.localName === 'path' && node.hasAttribute('data-vertices') && /[Aa]/.test(node.getAttribute('d')||'')) {
            polygons=JSON.parse(node.getAttribute('data-vertices')); pts=polygons?.[0]?.[0];radius=Number(node.getAttribute('data-corner-radius')||0);radiusUnit=node.getAttribute('data-radius-unit')||'px';
            cornerRadii=node.hasAttribute('data-corner-radii')?JSON.parse(node.getAttribute('data-corner-radii')):undefined;const candidate={...make('rectangle'),points:pts,polygons,radius,radiusUnit,cornerRadii};
            if(!G.valid({version:1,shapes:[candidate]}))throw Error('Corner radius ou vértices inválidos.');
            const compact=text=>text.replace(/[\s,]+/g,' ').trim(), d=compact(node.getAttribute('d')||'');
            if(d!==compact(G.shapePath(candidate)) && (!old || d!==compact(G.shapePath(old))))throw Error('Para alterar os cantos deste path, edite data-corner-radius, data-radius-unit ou data-vertices.');
            regeneratePath=d!==compact(G.shapePath(candidate));
        }
        else if (node.localName === 'path') {const contours=G.parseContours(node.getAttribute('d')||'');if(contours.length>1){polygons=G.fromContours(contours);if(!polygons.length)throw Error('O path não gerou área.');pts=polygons[0][0];}else pts=contours[0];}
        else if (node.localName === 'polygon') { const values = (node.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number); if (values.length % 2 || !values.every(Number.isFinite)) throw Error('Pontos do polygon inválidos.'); pts = []; for (let n = 0; n < values.length; n += 2) pts.push(values.slice(n, n + 2)); }
        else { const x = Number(node.getAttribute('x') || 0), y = Number(node.getAttribute('y') || 0), w = Number(node.getAttribute('width')), h = Number(node.getAttribute('height')); if (!(w > 0 && h > 0) || node.hasAttribute('rx') || node.hasAttribute('ry')) throw Error('Use um rect com largura e altura positivas, sem rx/ry.'); pts = G.points('rectangle', x, y, w, h); }
        const s = {...make('rectangle'), id: node.getAttribute('id') || old?.id || crypto.randomUUID(), type: 'custom', name: (node.getAttribute('aria-label') || old?.name || 'Forma ' + (i + 1)).slice(0, 80), points: pts, radius, radiusUnit,cornerRadii};
        if(polygons)s.polygons=polygons;
        if(regeneratePath)Object.defineProperty(s,'regeneratePath',{value:true});
        const attr = key => node.getAttribute(key) ?? svg.getAttribute(key);
        const fill = attr('fill'); s.noFill = fill === 'none'; s.fill = color(s.noFill ? null : fill, old?.fill || '#222427');
        s.stroke = color(attr('stroke') === 'none' ? null : attr('stroke'), old?.stroke || '#ff9b20');
        s.strokeWidth = attr('stroke') === 'none' ? 0 : Number(attr('stroke-width') ?? 2);
        s.opacity = Number(attr('opacity') ?? 1) * 100; s.join = attr('stroke-linejoin') || 'miter';
        return s;
    });
}
function applyCode() {
    clearTimeout(codeTimer); codeTimer = null;
    try {
        const next = parseCode($('source').value);
        if (!G.valid({version: 1, shapes: next})) throw Error('Verifique os pontos, identificadores, borda (0–30) e opacidade (0–1).');
        editingCode = true;
        change(() => { shapes = next.map(G.normalize); if (!current()) {clearSelection();if(shapes[0])selectShape(shapes[0].id);} else {selectedIds=new Set([selected]);clearParts();activeRing={p:0,r:0};}vertex=0; });
        lastCodeGeometry=G.svg(shapes);
        if(next.some(s=>s.regeneratePath))$('source').value=lastCodeGeometry;
        codeInvalid = false; codeStatus('✓ Código válido · mapa atualizado.'); return true;
    } catch (e) { codeInvalid = true; codeStatus(e.message + ' A última forma válida foi mantida.', true); return false; }
    finally { editingCode = false; }
}
$('code').onclick = () => { $('dialog').hidden = false; document.body.classList.add('code-open'); $('source').value = G.svg(shapes); lastCodeGeometry=$('source').value;codeInvalid = false; codeStatus('Edite o código; a atualização é automática.'); };
$('close').onclick = () => { if (codeTimer) applyCode(); $('dialog').hidden = true; document.body.classList.remove('code-open'); codeInvalid = false; };
$('source').addEventListener('input', () => { clearTimeout(codeTimer); codeStatus('Validando código…'); codeTimer = setTimeout(applyCode, 250); });
$('source').addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const a = e.target.selectionStart, b = e.target.selectionEnd; e.target.setRangeText('    ', a, b, 'end'); e.target.dispatchEvent(new Event('input')); } });
$('format').onclick = () => { if (applyCode()) { $('source').value = G.svg(shapes); codeStatus('Código formatado.'); } };
$('copy').onclick = async () => { try { await navigator.clipboard.writeText($('source').value); toast('Código copiado.'); } catch { $('source').select(); toast('Selecione o código e use Ctrl+C.'); } };
document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)||e.target.closest('.monaco-editor') || $('gridDialog').open) return;
    if (e.code === 'Space') { e.preventDefault(); space = true; }
    if ((e.ctrlKey || e.metaKey) && ['z', 'y', 's', 'd'].includes(e.key.toLowerCase())) {
        e.preventDefault(); const k = e.key.toLowerCase();
        if (k === 'z') (e.shiftKey ? $('redo') : $('undo')).click(); if (k === 'y') $('redo').click(); if (k === 's') $('save').click(); if (k === 'd') $('duplicate').click(); return;
    }
    if (e.key === 'Delete') $('delete').click();
    if (e.key === 'Escape') { if(drag)end({type:'pointercancel'}); clearSelection(); render(); }
    if(e.altKey&&e.shiftKey){const op={u:'union',s:'difference',i:'intersection',e:'xor',f:'flatten'}[e.key.toLowerCase()];if(op){e.preventDefault();combineShapes(op);return;}}
    if (e.key.toLowerCase() === 'v') tool('select'); if(e.key.toLowerCase()==='l')tool('lines');if (e.key.toLowerCase() === 'h') tool('hand'); if (e.key.toLowerCase() === 'm') $('magnet').click();
    if (current() && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault(); change(() => { const axis = ['ArrowLeft', 'ArrowRight'].includes(e.key) ? 0 : 1, sign = ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 1,step=sign*(axis?grid.stepY:grid.stepX)*(e.shiftKey?10:1);if(selectedPoints.size||selectedSegments.size){const delta=[0,0];delta[axis]=step;moveParts(allSelectedPoints(),delta);return;}if(selectedIds.size>1){shapes.filter(s=>selectedIds.has(s.id)).forEach(s=>G.mapShape(s,p=>p.map((n,i)=>G.round(n+(i===axis?step:0)))));return;}currentPoints()[vertex][axis]=G.round(currentPoints()[vertex][axis]+step);dirty(current()); });
    }
});
document.addEventListener('keyup', e => { if (e.code === 'Space') space = false; });
window.addEventListener('blur', () => { space = false; end(); });
new ResizeObserver(() => fit()).observe($('canvas')); fit();persist();
window.VectorBridge={svg:()=>G.svg(shapes),readWorkspace:()=>workspaceFiles,saveWorkspace:files=>{workspaceFiles=files;persist();},validate:text=>{try{const next=parseCode(text);if(!G.valid({version:1,shapes:next}))throw Error('Verifique pontos, borda e opacidade.');return {valid:true};}catch(e){return {valid:false,message:e.message,line:e.line||1};}},applySvg:text=>{$('source').value=text;return applyCode();},formatSvg:()=>{applyCode();return G.svg(shapes);},notify:toast,download,saveProject:()=>$('save').click()};

