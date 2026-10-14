import type * as monaco from 'monaco-editor';
import type { Workspace, ValidationResult, CodeTab } from '../domain/models';
import type EditorRepair from '../domain/code-repair';
export interface VectorBridge {
  svg(): string;
  readWorkspace(): Workspace;
  saveWorkspace(files: Workspace): void;
  validate(text: string): ValidationResult;
  applySvg(text: string): boolean;
  formatSvg(): string;
  notify(message: string): void;
  download(text: string, name: string, type: string): Promise<boolean>;
  saveProject(): void;
}
export interface Workbench {
  editor: monaco.editor.IStandaloneCodeEditor;
  monaco: typeof monaco;
  models: Record<'svg' | 'html' | 'css', monaco.editor.ITextModel>;
  switchTab(next: CodeTab): void;
  loadWorkspace(files: Workspace): void;
  setValue(language: 'svg' | 'html' | 'css', value: string): void;
  getValue(language: 'svg' | 'html' | 'css'): string;
  correct(language?: CodeTab): boolean;
  getMarkers(language: 'svg' | 'html' | 'css'): monaco.editor.IMarker[];
  exportHTML(): string;
}
declare global {
  const EDITOR_WORKER_SOURCE: string;
  const HTML_WORKER_SOURCE: string;
  const CSS_WORKER_SOURCE: string;
  interface Window {
    __TAURI__?: { core: { invoke<T>(command: string, args: Record<string, unknown>): Promise<T> } };
    VectorBridge: VectorBridge;
    CodeWorkbench?: Workbench;
    EditorRepair: typeof EditorRepair;
    MonacoEnvironment: { getWorker(id: string, label: string): Worker };
  }
}
