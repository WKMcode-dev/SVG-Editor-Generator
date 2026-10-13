const esbuild=require('esbuild'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const sources={};
 for(const [key,entry] of Object.entries({EDITOR_WORKER_SOURCE:'vs/editor/editor.worker.js',HTML_WORKER_SOURCE:'vs/language/html/html.worker.js',CSS_WORKER_SOURCE:'vs/language/css/css.worker.js'})){
  const result=await esbuild.build({entryPoints:[path.resolve('node_modules/monaco-editor/esm',entry)],bundle:true,format:'iife',platform:'browser',minify:true,write:false});sources[key]=JSON.stringify(result.outputFiles[0].text);
 }
 await esbuild.build({entryPoints:['editor-workbench.js'],bundle:true,format:'iife',platform:'browser',target:'chrome120',minify:true,outfile:'vendor/ide/workbench.js',define:sources,loader:{'.ttf':'file'},assetNames:'assets/[name]-[hash]'});
 fs.copyFileSync('node_modules/monaco-editor/LICENSE','vendor/ide/Monaco-LICENSE.txt');
 fs.copyFileSync('node_modules/monaco-editor/ThirdPartyNotices.txt','vendor/ide/ThirdPartyNotices.txt');
 console.log('Monaco, HTML/CSS e workers locais empacotados.');
})().catch(e=>{console.error(e);process.exit(1)});
