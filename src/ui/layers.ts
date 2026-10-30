import { iconMarkup } from './icons';
import type { Shape } from '../domain/models';
interface LayerActions {
  getShapes(): Shape[];
  getSelected(): Set<string>;
  select(ids: string[], multiple: boolean): void;
  update(ids: string[], patch: Partial<Shape>): void;
  renameGroup(id: string, name: string): void;
}
export function createLayers(
  container: HTMLElement,
  search: HTMLInputElement,
  actions: LayerActions,
) {
  const rows = new Map<string, HTMLElement>(),
    collapsed = new Set<string>();
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
    node.append(button, lock, eye);
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
