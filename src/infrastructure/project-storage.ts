import type { Project } from '../domain/models';
import { valid } from '../domain/geometry';
export const PROJECT_STORAGE_KEY = 'svg-editor-project';
const LARGE = '{"storage":"indexeddb"}';
export class ProjectStorage {
  private revision = 0;
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'>) {}
  needsAsyncLoad(): boolean {
    return this.storage.getItem(PROJECT_STORAGE_KEY) === LARGE;
  }
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
  private db(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('svg-editor-autosave', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('projects');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async loadLarge(): Promise<Project | null> {
    const db = await this.db();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('projects', 'readonly'),
          r = tx.objectStore('projects').get('current');
        r.onsuccess = () => {
          try {
            const p = JSON.parse(r.result);
            resolve(valid(p) ? p : null);
          } catch {
            resolve(null);
          }
        };
        r.onerror = () => reject(r.error);
      });
    } finally {
      db.close();
    }
  }
  save(project: Project): void {
    const text = JSON.stringify(project),
      rev = ++this.revision;
    if (text.length < 1_500_000) {
      this.storage.setItem(PROJECT_STORAGE_KEY, text);
      return;
    }
    void this.db()
      .then(async (db) => {
        try {
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction('projects', 'readwrite');
            tx.objectStore('projects').put(text, 'current');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
          });
          if (rev === this.revision) this.storage.setItem(PROJECT_STORAGE_KEY, LARGE);
          if (rev === this.revision) window.dispatchEvent(new CustomEvent('vector-storage-saved'));
        } finally {
          db.close();
        }
      })
      .catch(() => window.dispatchEvent(new CustomEvent('vector-storage-error')));
  }
}
