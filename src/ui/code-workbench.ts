import { exportDocument } from './preview-document';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.main.js';
import EditorRepair from '../domain/code-repair';
import type { CodeTab, Workspace } from '../domain/models';
import { element as $ } from './dom';
import { desktopBridge } from '../infrastructure/desktop-bridge';

const bridge = window.VectorBridge;
window.EditorRepair = EditorRepair;
// Language requests are canceled when a tab/model changes while analysis is running.
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.name === 'Canceled' || event.reason?.message === 'Canceled')
    event.preventDefault();
});
const workerUrls: Record<string, string> = {
  editor: URL.createObjectURL(new Blob([EDITOR_WORKER_SOURCE], { type: 'text/javascript' })),
  html: URL.createObjectURL(new Blob([HTML_WORKER_SOURCE], { type: 'text/javascript' })),
  css: URL.createObjectURL(new Blob([CSS_WORKER_SOURCE], { type: 'text/javascript' })),
};
window.MonacoEnvironment = {
  getWorker: (_id, label) =>
    new Worker(workerUrls[label] || workerUrls.editor, { name: `svg-editor-${label}` }),
};
window.addEventListener('beforeunload', () =>
  Object.values(workerUrls).forEach((url) => URL.revokeObjectURL(url)),
);
monaco.editor.defineTheme('quiet-paper', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'tag', foreground: 'A85F2F' },
    { token: 'attribute.name', foreground: '696356' },
    { token: 'attribute.value', foreground: '6F795F' },
    { token: 'comment', foreground: '90877B' },
  ],
  colors: {
    'editor.background': '#DED8CE',
    'editor.foreground': '#37352F',
    'editorLineNumber.foreground': '#928879',
    'editor.selectionBackground': '#C5B7A1',
    'editor.lineHighlightBackground': '#D6CFC3',
    'editorSuggestWidget.background': '#D6CFC3',
    'editorWidget.background': '#D6CFC3',
    'editorCursor.foreground': '#B46F39',
  },
});
monaco.editor.defineTheme('orange-night', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'tag', foreground: 'D5A16D' },
    { token: 'attribute.name', foreground: 'B7AD9B' },
    { token: 'attribute.value', foreground: 'C7AD82' },
    { token: 'string', foreground: 'C7AD82' },
    { token: 'number', foreground: '97A994' },
    { token: 'comment', foreground: '777970' },
  ],
  colors: {
    'editor.background': '#1C1B19',
    'editor.foreground': '#D2CEC5',
    'editorLineNumber.foreground': '#777269',
    'editor.selectionBackground': '#50402E',
    'editor.lineHighlightBackground': '#26231E',
    'editorSuggestWidget.background': '#282521',
    'editorWidget.background': '#282521',
    'editorCursor.foreground': '#D99046',
  },
});
const saved = bridge.readWorkspace(),
  initialSvg = $('source').value || bridge.svg();
const defaultCss =
  'body {\n    margin: 0;\n    padding: 28px;\n    background: #d6d1c8;\n    color: #37352f;\n    font-family: Segoe UI, sans-serif;\n}\n\n.card {\n    max-width: 640px;\n    margin: 0 auto;\n}\n\n.card-forma {\n    width: 100%;\n    height: auto;\n}\n\n.card-conteudo {\n    padding: 16px 0;\n}\n';
const wrap = (svg: string) =>
  `<div class="card">\n${svg.replace('<svg', '<svg class="card-forma"')}\n\n    <div class="card-conteudo">\n        <h2>PAINEL DE CONTROLE</h2>\n        <p>Meu design em SVG, HTML e CSS.</p>\n    </div>\n</div>`;
const models = {
  svg: monaco.editor.createModel(
    initialSvg,
    'html',
    monaco.Uri.parse('inmemory://design/design.svg'),
  ),
  html: monaco.editor.createModel(
    saved.html ?? wrap(initialSvg),
    'html',
    monaco.Uri.parse('inmemory://design/index.html'),
  ),
  css: monaco.editor.createModel(
    saved.css ?? defaultCss,
    'css',
    monaco.Uri.parse('inmemory://design/style.css'),
  ),
};
let tab: CodeTab = 'svg',
  mute = false,
  timer: ReturnType<typeof setTimeout> | undefined,
  repairTimer: ReturnType<typeof setTimeout> | undefined,
  previewApply = false,
  applyingDocument = false,
  previewRevision = 0;
$('editorTheme').value = ['vs-dark', 'vs', 'quiet-paper', 'orange-night', 'hc-black'].includes(
  saved.theme,
)
  ? saved.theme
  : 'orange-night';
$('autoRepair').checked = saved.autoRepair !== false;
const editor = monaco.editor.create($('monacoHost'), {
  model: models.svg,
  theme: $('editorTheme').value,
  automaticLayout: true,
  minimap: { enabled: false },
  fontSize: 12,
  fontFamily: 'Consolas, monospace',
  lineNumbers: 'on',
  tabSize: 4,
  insertSpaces: true,
  wordWrap: 'on',
  scrollBeyondLastLine: false,
  formatOnPaste: true,
  formatOnType: true,
  autoClosingBrackets: 'always',
  autoClosingQuotes: 'always',
  quickSuggestions: true,
  suggestOnTriggerCharacters: true,
  parameterHints: { enabled: true },
  renderValidationDecorations: 'on',
  padding: { top: 12 },
});
const sourceDescriptor = Object.getOwnPropertyDescriptor(
  HTMLTextAreaElement.prototype,
  'value',
) as {
  get: (this: HTMLTextAreaElement) => string;
  set: (this: HTMLTextAreaElement, value: string) => void;
};
function save() {
  bridge.saveWorkspace({
    html: models.html.getValue(),
    css: models.css.getValue(),
    theme: $('editorTheme').value,
    autoRepair: $('autoRepair').checked,
  });
}
window.addEventListener('pagehide', save);
window.addEventListener('beforeunload', save);
function replaceDocumentSvg(value: string) {
  if (applyingDocument) return;
  const html = models.html.getValue(),
    svg = value.replace('<svg', '<svg class="card-forma"');
  const next = /<svg\b[\s\S]*?<\/svg\s*>/i.test(html)
    ? html.replace(/<svg\b[\s\S]*?<\/svg\s*>/i, svg)
    : html + '\n' + svg;
  mute = true;
  models.html.setValue(next);
  mute = false;
}
Object.defineProperty($('source'), 'value', {
  configurable: true,
  get() {
    return sourceDescriptor.get.call(this);
  },
  set(value) {
    sourceDescriptor.set.call(this, value);
    if (models.svg.getValue() !== value) {
      mute = true;
      models.svg.setValue(value);
      mute = false;
      replaceDocumentSvg(value);
      schedulePreview(false);
    }
  },
});
function diagnostics() {
  const value = models.svg.getValue(),
    result = bridge.validate(value),
    markers: monaco.editor.IMarkerData[] = [];
  if (!result.valid) {
    const line = Math.min(models.svg.getLineCount(), Math.max(1, result.line || 1));
    markers.push({
      severity: monaco.MarkerSeverity.Error,
      message: result.message || 'Código inválido',
      startLineNumber: line,
      endLineNumber: line,
      startColumn: 1,
      endColumn: models.svg.getLineMaxColumn(line),
    });
  }
  monaco.editor.setModelMarkers(models.svg, 'svg-design', markers);
  showProblems();
  const htmlProblem = EditorRepair.inspectHTML(models.html.getValue());
  monaco.editor.setModelMarkers(
    models.html,
    'html-structure',
    htmlProblem
      ? [
          {
            severity: monaco.MarkerSeverity.Warning,
            message: htmlProblem.message,
            startLineNumber: htmlProblem.line,
            endLineNumber: htmlProblem.line,
            startColumn: 1,
            endColumn: models.html.getLineMaxColumn(htmlProblem.line),
          },
        ]
      : [],
  );
}
function showProblems() {
  const markers = monaco.editor.getModelMarkers({
    resource: models[tab === 'preview' ? 'html' : tab].uri,
  });
  $('editorProblems').textContent = markers.length
    ? `${markers.length} problema(s) · ${markers[0].message}`
    : 'Ctrl+Espaço: sugestões · Alt+Shift+F: formatar';
  $('editorProblems').classList.toggle(
    'error',
    markers.some((m) => m.severity === monaco.MarkerSeverity.Error),
  );
}
monaco.editor.onDidChangeMarkers(showProblems);
function applySvg() {
  sourceDescriptor.set.call($('source'), models.svg.getValue());
  $('source').dispatchEvent(new Event('input'));
  replaceDocumentSvg(models.svg.getValue());
  schedulePreview(false);
  diagnostics();
  save();
}
const webDocument = () => exportDocument(models.html.getValue(), models.css.getValue());
function schedulePreview(apply: boolean) {
  previewApply = apply;
  const revision = ++previewRevision;
  clearTimeout(timer);
  timer = setTimeout(() => {
    $('htmlPreview').srcdoc = webDocument().replace(
      '<head>',
      `<head><meta name="preview-revision" content="${revision}">`,
    );
    save();
  }, 250);
}
function hexColor(value: string) {
  if (value === 'none') return 'none';
  const numbers = value.match(/[\d.]+/g);
  return numbers && numbers.length >= 3
    ? '#' +
        numbers
          .slice(0, 3)
          .map((n) =>
            Math.max(0, Math.min(255, Math.round(Number(n))))
              .toString(16)
              .padStart(2, '0'),
          )
          .join('')
    : value;
}
$('htmlPreview').addEventListener('load', () => {
  if (
    !previewApply ||
    Number(
      $('htmlPreview').contentDocument?.querySelector<HTMLMetaElement>(
        'meta[name="preview-revision"]',
      )?.content,
    ) !== previewRevision
  )
    return;
  previewApply = false;
  try {
    const doc = $('htmlPreview').contentDocument,
      svg = doc?.querySelector('svg');
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll('style,script').forEach((n) => n.remove());
    const originals = [...svg.querySelectorAll('path,rect,polygon')],
      copies = [...clone.querySelectorAll('path,rect,polygon')];
    originals.forEach((node, i) => {
      const style = $('htmlPreview').contentWindow!.getComputedStyle(node),
        copy = copies[i];
      copy.removeAttribute('style');
      copy.setAttribute('fill', hexColor(style.fill));
      copy.setAttribute('stroke', hexColor(style.stroke));
      copy.setAttribute('stroke-width', String(parseFloat(style.strokeWidth) || 0));
      copy.setAttribute('opacity', style.opacity);
      copy.setAttribute('stroke-linejoin', style.strokeLinejoin);
    });
    clone.removeAttribute('style');
    const value = new XMLSerializer().serializeToString(clone),
      validation = bridge.validate(value);
    if (!validation.valid) {
      $('editorProblems').textContent = 'Prévia disponível. Vetor: ' + validation.message;
      return;
    }
    applyingDocument = true;
    mute = true;
    models.svg.setValue(value);
    sourceDescriptor.set.call($('source'), value);
    mute = false;
    bridge.applySvg(value);
    const formatted = bridge.svg();
    mute = true;
    models.svg.setValue(formatted);
    sourceDescriptor.set.call($('source'), formatted);
    mute = false;
    applyingDocument = false;
    diagnostics();
  } catch (e) {
    applyingDocument = false;
    mute = false;
    $('editorProblems').textContent = 'Prévia: ' + (e instanceof Error ? e.message : String(e));
  }
});
function correct(language: CodeTab = tab) {
  if (language === 'preview') language = 'html';
  const model = models[language],
    value = model.getValue(),
    next = window.EditorRepair.repair(value, language);
  if (next === value) return false;
  if (language === 'svg' && !bridge.validate(next).valid) return false;
  model.pushStackElement();
  model.pushEditOperations([], [{ range: model.getFullModelRange(), text: next }], () => null);
  model.pushStackElement();
  return true;
}
(Object.entries(models) as ['svg' | 'html' | 'css', monaco.editor.ITextModel][]).forEach(
  ([language, model]) =>
    model.onDidChangeContent((event) => {
      if (mute) return;
      clearTimeout(repairTimer);
      if (language === 'svg') applySvg();
      else {
        schedulePreview(true);
        save();
        diagnostics();
      }
      if ($('autoRepair').checked && !event.isUndoing && !event.isRedoing)
        repairTimer = setTimeout(() => correct(language), 1200);
    }),
);
function switchTab(next: CodeTab) {
  tab = next;
  $('monacoHost').hidden = next === 'preview';
  $('htmlPreview').hidden = next !== 'preview';
  document
    .querySelectorAll<HTMLButtonElement>('[data-code-tab]')
    .forEach((b) => b.classList.toggle('active', b.dataset.codeTab === next));
  if (next !== 'preview') {
    editor.setModel(models[next]);
    editor.layout();
  } else schedulePreview(false);
  showProblems();
}
document
  .querySelectorAll<HTMLButtonElement>('[data-code-tab]')
  .forEach((b) => (b.onclick = () => switchTab(b.dataset.codeTab as CodeTab)));
$('editorTheme').onchange = () => {
  monaco.editor.setTheme($('editorTheme').value);
  save();
};
$('autoRepair').onchange = () => {
  clearTimeout(repairTimer);
  save();
};
$('repair').onclick = () => {
  const changed = correct();
  $('editorProblems').textContent = changed
    ? 'Correções aplicadas. Ctrl+Z desfaz.'
    : 'Nenhuma correção simples disponível; confira os diagnósticos.';
};
$('format').onclick = async () => {
  if (tab === 'svg') {
    if (bridge.validate(models.svg.getValue()).valid) {
      const formatted = bridge.formatSvg();
      $('source').value = formatted;
    }
  } else if (tab !== 'preview') await editor.getAction('editor.action.formatDocument')?.run();
};
$('copy').onclick = async () => {
  try {
    await desktopBridge.copy(models[tab === 'preview' ? 'html' : tab].getValue());
    bridge.notify('Código copiado.');
  } catch {
    editor.focus();
    editor.setSelection(models[tab === 'preview' ? 'html' : tab].getFullModelRange());
  }
};
$('exportWeb').onclick = () => {
  correct('html');
  correct('css');
  bridge.download(webDocument(), 'meu-design.html', 'text/html');
};
editor.addAction({
  id: 'svg-correct',
  label: 'Corrigir problemas simples',
  run: () => {
    correct();
  },
});
monaco.languages.registerCompletionItemProvider('html', {
  triggerCharacters: ['<', ' ', '"'],
  provideCompletionItems(model, position) {
    const word = model.getWordUntilPosition(position),
      range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
    return {
      suggestions: [
        {
          label: 'svg-path',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText:
            'path d="M ${1:100} ${2:100} L ${3:300} ${2:100} L ${3:300} ${4:200} Z" fill="${5:#222427}" stroke="${6:#d99046}" />',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'stroke-width',
          kind: monaco.languages.CompletionItemKind.Property,
          insertText: 'stroke-width="${1:2}"',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
      ],
    };
  },
});
window.addEventListener('vector-code-status', diagnostics);
function loadWorkspace(files: Workspace) {
  mute = true;
  models.svg.setValue(bridge.svg());
  sourceDescriptor.set.call($('source'), models.svg.getValue());
  models.html.setValue(files.html ?? wrap(models.svg.getValue()));
  models.css.setValue(files.css ?? defaultCss);
  mute = false;
  $('editorTheme').value = ['vs-dark', 'vs', 'quiet-paper', 'orange-night', 'hc-black'].includes(
    files.theme,
  )
    ? files.theme
    : 'orange-night';
  monaco.editor.setTheme($('editorTheme').value);
  $('autoRepair').checked = files.autoRepair !== false;
  diagnostics();
  schedulePreview(false);
  save();
}
editor.addAction({
  id: 'save-design-project',
  label: 'Salvar projeto SVG/HTML/CSS',
  keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
  run: () => {
    save();
    bridge.saveProject();
  },
});
window.CodeWorkbench = {
  editor,
  monaco,
  models,
  switchTab,
  loadWorkspace,
  setValue: (language, value) => models[language].setValue(value),
  getValue: (language) => models[language].getValue(),
  correct,
  getMarkers: (language) => monaco.editor.getModelMarkers({ resource: models[language].uri }),
  exportHTML: webDocument,
};
diagnostics();
schedulePreview(false);
