import type { UiElementMap } from './element-map';
export function element<K extends keyof UiElementMap>(id: K): UiElementMap[K];
export function element(id: string): HTMLElement;
export function element(id: string): Element {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Elemento obrigatório ausente: ${id}`);
  return node;
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function formControl(id: string): HTMLInputElement | HTMLSelectElement {
  const node = document.getElementById(id);
  if (!(node instanceof HTMLInputElement || node instanceof HTMLSelectElement))
    throw new Error(`Campo obrigatório ausente: ${id}`);
  return node;
}

/** Layout updates must not replace a value while the user is typing it. */
export function setFormValue(
  control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string,
): void {
  if (document.activeElement === control && control.dataset.editing === 'true') return;
  control.value = value;
}
export function trackFormEditing(): void {
  document.addEventListener(
    'input',
    (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)
        event.target.dataset.editing = 'true';
    },
    true,
  );
  document.addEventListener(
    'change',
    (event) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)
        delete event.target.dataset.editing;
    },
    true,
  );
}
