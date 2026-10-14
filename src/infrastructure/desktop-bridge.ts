// Keep the editor usable in a browser as well as the native Tauri window.
export const desktopBridge = {
  async copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Works when clipboard permissions are unavailable in the WebView.
      const input = document.createElement('textarea');
      input.value = text;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      const previous = document.activeElement as HTMLElement | null;
      document.body.appendChild(input);
      try {
        input.select();
        if (!document.execCommand('copy')) throw new Error('Use Ctrl+C para copiar.');
      } finally {
        input.remove();
        previous?.focus();
      }
    }
  },
  async save(text: string, name: string, type: string) {
    if (window.__TAURI__?.core?.invoke) {
      return window.__TAURI__.core.invoke<boolean>('save_document', { name, content: text });
    }
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return true;
  },
};
