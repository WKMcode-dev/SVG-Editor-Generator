import { iconMarkup } from './icons';
import type { Shape } from '../domain/models';
interface LayerActions {
  getShapes(): Shape[];
  getSelected(): Set<string>;
  select(ids: string[], multiple: boolean): void;
  update(ids: string[], patch: Partial<Shape>): void;
  renameGroup(id: string, name: string): void;
  reorder(source: string[], target: string[], above: boolean): void;
}
export function createLayers(
  container: HTMLElement,
  search: HTMLInputElement,
  actions: LayerActions,
) {
  const rows = new Map<string, HTMLElement>(),
    collapsed = new Set<string>();
  let dragging: string[] | null = null;
  function clearDrop() {
    container
      .querySelectorAll('[data-drop-position]')
      .forEach((node) => node.removeAttribute('data-drop-position'));
  }
  function rename(label: HTMLElement, value: string, save: (name: string) => void) {
    if (label.querySelector('input')) return;
    const input = document.createElement('input');
    input.className = 'layer-name-input';
    input.value = value;
    input.maxLength = 80;
    input.setAttribute('aria-label', 'Renomear camada');
    label.replaceChildren(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (commit: boolean) => {
      if (done) return;
      done = true;
      const name = input.value.trim();
      input.remove();
      label.textContent = commit && name ? name : value;
      if (commit && name) save(name);
    };
    input.onblur = () => finish(true);
    input.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') finish(true);
      if (e.key === 'Escape') finish(false);
    };
    input.onclick = (e) => e.stopPropagation();
  }
  function row(key: string, group: boolean): HTMLElement {
    if (rows.has(key)) return rows.get(key)!;
    const node = document.createElement('div');
    node.className = 'layer-row' + (group ? ' group-row' : '');
    node.dataset.key = key;
    const button = document.createElement('button');
    button.className = 'layer';
    const glyph = document.createElement('span');
    glyph.className = 'layer-glyph';
    const name = document.createElement('span');
    name.className = 'layer-name';
    button.append(glyph, name);
    const ids = () =>
      group
        ? actions
            .getShapes()
            .filter((s) => s.group?.id === key.slice(6))
            .map((s) => s.id)
        : [key];
    node.draggable = true;
    node.addEventListener('dragstart', (event) => {
      if ((event.target as Element).closest('input') || node.classList.contains('is-locked')) {
        event.preventDefault();
        return;
      }
      dragging = ids();
      event.dataTransfer?.setData('text/plain', JSON.stringify(dragging));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      node.classList.add('is-dragging');
    });
    node.addEventListener('dragover', (event) => {
      if (!dragging) return;
      event.preventDefault();
      event.stopPropagation();
      clearDrop();
      node.dataset.dropPosition =
        event.clientY < node.getBoundingClientRect().top + node.clientHeight / 2
          ? 'above'
          : 'below';
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      const bounds = container.getBoundingClientRect();
      if (event.clientY < bounds.top + 28) container.scrollBy(0, -14);
      if (event.clientY > bounds.bottom - 28) container.scrollBy(0, 14);
    });
    node.addEventListener('drop', (event) => {
      if (!dragging) return;
      event.preventDefault();
      event.stopPropagation();
      const source = dragging;
      const above = node.dataset.dropPosition === 'above';
      dragging = null;
      clearDrop();
      actions.reorder(source, ids(), above);
    });
    node.addEventListener('dragend', () => {
      dragging = null;
      clearDrop();
      node.classList.remove('is-dragging');
    });
    button.onclick = (e) => actions.select(ids(), e.shiftKey || e.ctrlKey || e.metaKey);
    name.ondblclick = (e) => {
      e.stopPropagation();
      const item = actions.getShapes().find((s) => ids().includes(s.id));
      if (!item) return;
      rename(name, group ? item.group!.name : item.name, (n) =>
        group ? actions.renameGroup(item.group!.id, n) : actions.update(ids(), { name: n }),
      );
    };
    if (group) {
      glyph.onclick = (e) => {
        e.stopPropagation();
        collapsed.has(key) ? collapsed.delete(key) : collapsed.add(key);
        render();
      };
    }
    const lock = document.createElement('button');
    lock.className = 'layer-toggle layer-lock';
    lock.onclick = () => {
      const selected = actions.getShapes().filter((s) => ids().includes(s.id));
      actions.update(ids(), { locked: !selected.every((s) => s.locked) });
    };
    const eye = document.createElement('button');
    eye.className = 'layer-toggle layer-eye';
    eye.onclick = () => {
      const selected = actions.getShapes().filter((s) => ids().includes(s.id));
      actions.update(ids(), { hidden: !selected.every((s) => s.hidden) });
    };
    const grip = document.createElement('button');
    grip.className = 'layer-grip';
    grip.title = 'Arrastar camada; setas para reordenar';
    grip.setAttribute('aria-label', 'Reordenar camada');
    grip.innerHTML = iconMarkup('grip', 16);
    grip.draggable = false;
    let pointer: number | null = null,
      moved = false,
      startY = 0;
    const finish = (event: PointerEvent, commit: boolean) => {
      if (pointer !== event.pointerId) return;
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('.layer-row');
      const key = target?.dataset.key;
      const above = target?.dataset.dropPosition === 'above';
      if (grip.hasPointerCapture(event.pointerId)) grip.releasePointerCapture(event.pointerId);
      pointer = null;
      dragging = null;
      clearDrop();
      node.classList.remove('is-dragging');
      if (commit && moved && key && target !== node) {
        const targetIds = key.startsWith('group:')
          ? actions
              .getShapes()
              .filter((shape) => shape.group?.id === key.slice(6) && !shape.booleanParent)
              .map((shape) => shape.id)
          : [key];
        actions.reorder(ids(), targetIds, above);
      }
    };
    grip.onpointerdown = (event) => {
      if (node.classList.contains('is-locked')) return;
      if (event.pointerType !== 'touch') event.preventDefault();
      event.stopPropagation();
      pointer = event.pointerId;
      startY = event.clientY;
      moved = false;
      dragging = ids();
      grip.setPointerCapture(event.pointerId);
    };
    grip.onpointermove = (event) => {
      if (pointer !== event.pointerId) return;
      moved ||= Math.abs(event.clientY - startY) > 4;
      if (!moved) return;
      node.classList.add('is-dragging');
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('.layer-row');
      clearDrop();
      if (target && target !== node)
        target.dataset.dropPosition =
          event.clientY < target.getBoundingClientRect().top + target.clientHeight / 2
            ? 'above'
            : 'below';
      const bounds = container.getBoundingClientRect();
      if (event.clientY < bounds.top + 28) container.scrollBy(0, -14);
      if (event.clientY > bounds.bottom - 28) container.scrollBy(0, 14);
    };
    grip.onpointerup = (event) => finish(event, true);
    grip.onpointercancel = (event) => finish(event, false);
    grip.onclick = (event) => event.stopPropagation();
    grip.onkeydown = (event) => {
      if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      const all = actions.getShapes(),
        source = all.find((shape) => ids().includes(shape.id));
      const siblings = all.filter((shape) => shape.booleanParent === source?.booleanParent);
      const index = siblings.findIndex((shape) => shape.id === source?.id);
      const target = siblings[index + (event.key === 'ArrowUp' ? 1 : -1)];
      if (target) actions.reorder(ids(), [target.id], event.key === 'ArrowUp');
    };
    node.append(grip, button, lock, eye);
    rows.set(key, node);
    return node;
  }
  function render() {
    const shapes = [...actions.getShapes()].reverse(),
      query = search.value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase(),
      desired: HTMLElement[] = [];
    const seen = new Set<string>();
    function update(node: HTMLElement, items: Shape[], name: string, icon: string, child = false) {
      const locked = items.every((s) => s.locked),
        hidden = items.every((s) => s.hidden),
        button = node.querySelector<HTMLButtonElement>('.layer')!;
      node.classList.toggle('child-layer', child);
      node.classList.toggle('is-hidden', hidden);
      node.classList.toggle('is-locked', locked);
      button.classList.toggle(
        'active',
        items.some((s) => actions.getSelected().has(s.id)),
      );
      button.setAttribute(
        'aria-pressed',
        String(items.some((s) => actions.getSelected().has(s.id))),
      );
      button.title = name;
      const label = node.querySelector<HTMLElement>('.layer-name')!;
      if (!label.querySelector('input')) label.textContent = name;
      node.querySelector('.layer-glyph')!.textContent = icon;
      const lock = node.querySelector<HTMLButtonElement>('.layer-lock')!,
        eye = node.querySelector<HTMLButtonElement>('.layer-eye')!;
      lock.innerHTML = iconMarkup(locked ? 'lock' : 'unlock');
      lock.title = (locked ? 'Desbloquear ' : 'Bloquear ') + name;
      lock.setAttribute('aria-label', lock.title);
      lock.setAttribute('aria-pressed', String(locked));
      eye.innerHTML = iconMarkup(hidden ? 'eye-off' : 'eye');
      eye.title = (hidden ? 'Mostrar ' : 'Ocultar ') + name;
      eye.setAttribute('aria-label', eye.title);
      eye.setAttribute('aria-pressed', String(hidden));
    }
    const match = (s: Shape) =>
      (s.name + ' ' + (s.group?.name || ''))
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase()
        .includes(query);
    function appendBoolean(shape: Shape, child = false, depth = 0) {
      if (!match(shape) && !shapes.some((s) => s.booleanParent === shape.id && match(s))) return;
      const node = row(shape.id, false),
        isGroup = !!shape.boolean;
      update(
        node,
        [shape],
        shape.name,
        isGroup ? (collapsed.has(shape.id) ? '›' : '⌄') : '◇',
        child,
      );
      node.style.paddingLeft = depth ? `${depth * 12}px` : '';
      node.classList.toggle('boolean-group', isGroup);
      if (isGroup) {
        node.querySelector<HTMLElement>('.layer-glyph')!.onclick = (e) => {
          e.stopPropagation();
          collapsed.has(shape.id) ? collapsed.delete(shape.id) : collapsed.add(shape.id);
          render();
        };
        node
          .querySelector('.layer')!
          .setAttribute('aria-expanded', String(!collapsed.has(shape.id)));
      }
      desired.push(node);
      if (isGroup && (!collapsed.has(shape.id) || query))
        shapes
          .filter((s) => s.booleanParent === shape.id)
          .forEach((s) => appendBoolean(s, true, depth + 1));
    }
    for (const shape of shapes) {
      if (shape.booleanParent) continue;
      if (shape.boolean && !shape.group) {
        appendBoolean(shape);
        continue;
      }
      if (shape.group) {
        const key = 'group:' + shape.group.id;
        if (seen.has(key)) continue;
        seen.add(key);
        const children = shapes.filter((s) => !s.booleanParent && s.group?.id === shape.group!.id);
        if (!children.some(match)) continue;
        const header = row(key, true);
        update(header, children, shape.group.name, collapsed.has(key) ? '›' : '⌄');
        desired.push(header);
        if (collapsed.has(key) && !query) continue;
        for (const child of children.filter(match)) {
          if (child.boolean) {
            appendBoolean(child, true, 1);
            continue;
          }
          const node = row(child.id, false);
          update(node, [child], child.name, '◇', true);
          desired.push(node);
        }
      } else if (match(shape)) {
        const node = row(shape.id, false);
        update(
          node,
          [shape],
          shape.name,
          (
            { ellipse: '○', line: '╱', arrow: '↗', image: '▧', video: '▷', star: '☆' } as Record<
              string,
              string
            >
          )[shape.type] || '◇',
        );
        desired.push(node);
      }
    }
    for (const node of [...container.children])
      if (!desired.includes(node as HTMLElement)) node.remove();
    desired.forEach((node, i) => {
      if (container.children[i] !== node)
        container.insertBefore(node, container.children[i] || null);
    });
    if (!desired.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-layers';
      empty.textContent = query
        ? 'Nenhuma camada encontrada.'
        : 'Seu projeto ainda não tem camadas.';
      container.append(empty);
    }
  }
  return { render };
}
