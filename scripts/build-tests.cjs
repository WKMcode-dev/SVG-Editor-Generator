const esbuild = require('esbuild');
const path = require('node:path');
(async () => {
  const root = path.resolve(__dirname, '..');
  await esbuild.build({
    entryPoints: [path.join(root, 'src/application/editor-controller.ts')],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    outfile: path.join(root, '.test-build/controller.js'),
  });
  for (const [file, entry] of Object.entries({
    'geometry.cjs': 'src/domain/geometry.ts',
    'code-repair.cjs': 'src/domain/code-repair.ts',
    'project-storage.cjs': 'src/infrastructure/project-storage.ts',
    'desktop-bridge.cjs': 'src/infrastructure/desktop-bridge.ts',
  }))
    await esbuild.build({
      entryPoints: [path.join(root, entry)],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: path.join(root, '.test-build', file),
    });
  await esbuild.build({
    entryPoints: [path.join(root, 'src/infrastructure/desktop-bridge.ts')],
    bundle: true,
    format: 'iife',
    globalName: 'DesktopBridgeTest',
    outfile: path.join(root, '.test-build/desktop-bridge.vm.js'),
  });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
