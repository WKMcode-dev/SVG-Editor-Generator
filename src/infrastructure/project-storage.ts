import type { Project } from '../domain/models';
import { valid } from '../domain/geometry';
export const PROJECT_STORAGE_KEY = 'svg-editor-project';
export class ProjectStorage {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'>) {}
  load(): Project | null {
    try {
      const text =
        this.storage.getItem(PROJECT_STORAGE_KEY) ?? this.storage.getItem('scifi-project');
      if (!text) return null;
      const value: unknown = JSON.parse(text);
      return valid(value) ? value : null;
    } catch {
      return null;
    }
  }
  save(project: Project): void {
    this.storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
  }
}
