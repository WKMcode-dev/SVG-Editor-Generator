const esbuild = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
async function build() {
  const dist = path.join(root, 'dist');
  fs.rmSync(dist, { recursive: true, force: true });
  fs.cpSync(path.join(root, 'public'), dist, { recursive: true });
  const sources = {};
  for (const [key, entry] of Object.entries({
    EDITOR_WORKER_SOURCE: 'vs/editor/editor.worker.js',
    HTML_WORKER_SOURCE: 'vs/language/html/html.worker.js',
    CSS_WORKER_SOURCE: 'vs/language/css/css.worker.js',
  })) {
    const worker = await esbuild.build({
      entryPoints: [path.join(root, 'node_modules/monaco-editor/esm', entry)],
      bundle: true,
      format: 'iife',
      platform: 'browser',
      minify: true,
      write: false,
    });
    sources[key] = JSON.stringify(worker.outputFiles[0].text);
  }
  await esbuild.build({
    entryPoints: [path.join(root, 'src/main.ts')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'chrome120',
    minify: true,
    outfile: path.join(dist, 'assets/app.js'),
    define: sources,
    loader: { '.ttf': 'file' },
    assetNames: 'fonts/[name]-[hash]',
  });
  fs.mkdirSync(path.join(dist, 'licenses'), { recursive: true });
  for (const [input, output] of [
    ['monaco-editor/LICENSE', 'Monaco-LICENSE.txt'],
    ['monaco-editor/ThirdPartyNotices.txt', 'ThirdPartyNotices.txt'],
    ['polygon-clipping/LICENSE.md', 'polygon-clipping-LICENSE.md'],
  ])
    fs.copyFileSync(path.join(root, 'node_modules', input), path.join(dist, 'licenses', output));
  console.log('TypeScript, Monaco e workers compilados em dist/.');
}
build().catch((error) => {
  console.error(error);
  process.exit(1);
});
