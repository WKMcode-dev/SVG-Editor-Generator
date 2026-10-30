import type { Shape, Point } from '../domain/models';
import * as G from '../domain/geometry';
interface Preset {
  id: string;
  name: string;
  shapes: Shape[];
}
export function installPresets(options: {
  getSelected(): Shape[];
  insert(shapes: Shape[]): void;
  center(): Point;
  notify(message: string): void;
}): void {
  const host = document.getElementById('savedPresets')!;
  let presets: Preset[] = [];
  try {
    const saved = JSON.parse(localStorage.getItem('svg-editor-presets') || '[]');
    if (Array.isArray(saved))
      presets = saved
        .filter(
          (p) =>
            p &&
            typeof p.name === 'string' &&
            typeof p.id === 'string' &&
            G.valid({ version: 1, shapes: p.shapes }),
        )
        .slice(0, 20);
  } catch {}
  const persist = () => {
    try {
      localStorage.setItem('svg-editor-presets', JSON.stringify(presets));
      return true;
    } catch {
      options.notify('Não foi possível salvar o preset. Exporte seu projeto para fazer backup.');
      return false;
    }
  };
  function render() {
    host.replaceChildren();
    for (const preset of presets) {
      const row = document.createElement('div');
      row.className = 'saved-preset';
      const use = document.createElement('button');
      use.textContent = '◇ ' + preset.name;
      use.title = 'Inserir ' + preset.name;
      use.onclick = () => {
        const copies = structuredClone(preset.shapes),
          b = G.exportBounds(copies),
          c = options.center(),
          groups = new Map<string, string>();
        copies.forEach((s) => {
          s.id = crypto.randomUUID();
          s.locked = false;
          s.hidden = false;
          if (s.group) {
            if (!groups.has(s.group.id)) groups.set(s.group.id, crypto.randomUUID());
            s.group.id = groups.get(s.group.id)!;
          }
          G.mapShape(s, ([x, y]) => [
            G.round(x + c[0] - b.x - b.width / 2),
            G.round(y + c[1] - b.y - b.height / 2),
          ]);
        });
        options.insert(copies);
      };
      const remove = document.createElement('button');
      remove.textContent = '×';
      remove.title = 'Excluir preset ' + preset.name;
      remove.onclick = () => {
        presets = presets.filter((p) => p.id !== preset.id);
        persist();
        render();
      };
      row.append(use, remove);
      host.append(row);
    }
  }
  document.getElementById('savePreset')!.onclick = () => {
    const selected = options.getSelected();
    if (!selected.length) return options.notify('Selecione as camadas do preset.');
    if (presets.length >= 20) return options.notify('Limite de 20 presets locais.');
    const preset = {
      id: crypto.randomUUID(),
      name: (selected.length === 1
        ? selected[0].name
        : selected[0].group?.name || 'Preset ' + (presets.length + 1)
      ).slice(0, 80),
      shapes: structuredClone(selected),
    };
    if (JSON.stringify([...presets, preset]).length > 1_500_000)
      return options.notify(
        'Presets locais aceitam até 1 MB no total. Para mídia, use um projeto JSON.',
      );
    presets.push(preset);
    if (!persist()) presets.pop();
    render();
  };
  render();
}
