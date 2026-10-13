const {chromium,_electron}=require('C:/Users/wkmco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const packaged=process.argv.includes('--packaged');
 const browser=packaged?await _electron.launch({executablePath:path.resolve('release/1.5.0/win-unpacked/SVG Editor Generator.exe'),args:['--headless','--test-hidden']}):await chromium.launch({headless:true,channel:'msedge'});
 try {
  const page=packaged?await browser.firstWindow():await browser.newPage({viewport:{width:1440,height:940}}),errors=[];
  page.on('pageerror',e=>e.message!=='Canceled'&&errors.push(e.message));
  if(!packaged)await page.goto(require('node:url').pathToFileURL(path.resolve('index.html')).href);
  else {await page.waitForSelector('#canvas');await page.evaluate(()=>localStorage.clear());await page.reload();}
  await page.waitForSelector('.handle');
  const set=async(id,value)=>{await page.locator('#'+id).fill(value);await page.locator('#'+id).dispatchEvent('change');};
  await set('radius','20');assert.match(await page.locator('.shape').getAttribute('d'),/A 20 20/);assert.equal(await page.locator('.handle').count(),4);
  await page.click('#undo');assert.ok(!(await page.locator('.shape').getAttribute('d')).includes('A '));await page.click('#redo');
  await page.selectOption('#radiusUnit','%');assert.equal(Number(await page.locator('#radius').inputValue()),9.091);
  await set('radius','80');assert.equal(await page.locator('#radius').inputValue(),'50');assert.match(await page.locator('.shape').getAttribute('d'),/A 110 110/);
  await page.reload();await page.waitForSelector('.handle');assert.equal(await page.locator('#radius').inputValue(),'50');assert.equal(await page.locator('#radiusUnit').inputValue(),'%');
  const result=await page.evaluate(()=>{const svg=VectorBridge.svg();const ok=VectorBridge.applySvg(svg);return {ok,svg,valid:VectorBridge.validate(svg)};});assert.equal(result.ok,true);assert.equal(result.valid.valid,true);
  assert.equal(await page.locator('#radius').inputValue(),'50');
  assert.equal(await page.evaluate(()=>VectorBridge.applySvg(VectorBridge.svg().replace('data-corner-radius="50"','data-corner-radius="10"'))),true);
  assert.equal(await page.locator('#radius').inputValue(),'10');assert.match(await page.locator('.shape').getAttribute('d'),/A 22 22/);
  assert.match(await page.locator('#source').inputValue(),/A 22 22/);
  assert.equal(await page.evaluate(()=>VectorBridge.validate(document.getElementById('source').value).valid),true);
  if(!packaged)await page.screenshot({path:'tests/radius-preview.png'});assert.deepEqual(errors,[]);
  console.log('Corner radius: px, %, limite, histórico, restauração e edição SVG aprovados.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
