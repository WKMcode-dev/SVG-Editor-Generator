const {_electron} = require('C:/Users/wkmco/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict'), path = require('node:path');
(async () => {
    const packaged = process.argv.includes('--packaged');
    const app = await _electron.launch({executablePath: path.resolve(packaged ? 'release/1.5.0/win-unpacked/SVG Editor Generator.exe' : 'node_modules/electron/dist/electron.exe'), args: packaged ? ['--headless','--test-hidden'] : ['--headless',path.resolve('desktop.cjs'),'--test-hidden']});
    try {
        const page = await app.firstWindow(), errors = [];
        page.on('pageerror', e => e.message!=='Canceled'&&errors.push(e.message));
        await page.waitForSelector('#canvas');
        await page.evaluate(() => {localStorage.clear();}); await page.reload();
        await page.waitForSelector('.handle'); assert.equal(await page.title(), 'SVG Editor Generator');assert.equal(await page.locator('.handle').count(),4);
        const edge = await page.evaluate(() => {const svg=document.getElementById('canvas'),p=svg.createSVGPoint();p.x=400;p.y=140;const q=p.matrixTransform(document.getElementById('camera').getScreenCTM());return [q.x,q.y];});
        await page.mouse.dblclick(...edge);assert.equal(await page.locator('.handle').count(),5);
        await page.click('#code'); const source=await page.locator('#source').inputValue();await page.evaluate(text=>window.CodeWorkbench.setValue('svg',text),source.replace('M 200 140','M 180 100'));
        await page.waitForFunction(()=>document.getElementById('codeStatus').textContent.includes('mapa atualizado'));
        assert.equal(await page.locator('.handle').first().getAttribute('cx'),'180');
        await page.click('#close');await page.click('#delete');assert.equal(await page.locator('.handle').count(),0);assert.equal(await page.locator('.shape').count(),0);
        await page.click('[data-type="rectangle"]');await page.click('#duplicate');await page.locator('.layer').last().click({modifiers:['Shift']});await page.click('#booleanMenu');await page.click('[data-operation="union"]');assert.equal(await page.locator('.shape').count(),1);assert.equal(await page.locator('#shapeWidth').inputValue(),'424');
        await page.click('#background');await page.reload();await page.waitForSelector('.shape');assert.ok(await page.locator('.stage').evaluate(e=>e.classList.contains('map-light')));assert.equal(await page.locator('#title').innerText(),'União');
        await page.click('#delete');await page.click('[data-type="rectangle"]');await page.click('#lineSelect');
        const screen=async(x,y)=>page.evaluate(([x,y])=>{const svg=document.getElementById('canvas'),p=svg.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(document.getElementById('camera').getScreenCTM());return [q.x,q.y];},[x,y]);
        await page.mouse.click(...await screen(400,140));await page.mouse.click(...await screen(600,250));assert.equal(await page.locator('.selected-edge').count(),2);
        await page.mouse.move(...await screen(400,140));await page.mouse.down();await page.mouse.move(...await screen(420,160),{steps:5});await page.mouse.up();
        assert.deepEqual(await page.evaluate(()=>Geometry.parseContours(document.querySelector('.shape').getAttribute('d'))[0]),[[220,160],[620,160],[620,380],[200,360]]);
        await page.click('#undo');await page.click('#select');await page.mouse.move(...await screen(100,100));await page.mouse.down();await page.mouse.move(...await screen(650,170),{steps:5});await page.mouse.up();assert.equal(await page.locator('.handle.selected').count(),2);
        await page.click('#code');await page.waitForSelector('.monaco-editor');await page.click('[data-code-tab="css"]');await page.evaluate(()=>window.CodeWorkbench.setValue('css','.card-forma path { stroke: #bf8656; fill: #65615a; }'));await page.waitForFunction(()=>document.querySelector('.shape').getAttribute('stroke')==='#bf8656');
        await page.evaluate(()=>window.CodeWorkbench.setValue('css','body { unknown-property: red; }'));await page.waitForFunction(()=>window.CodeWorkbench.getMarkers('css').some(m=>/Unknown property/i.test(m.message)));await page.click('#close');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        await page.click('#lineSelect');
        await page.mouse.move(...await screen(100,100));await page.mouse.down();await page.mouse.move(...await screen(650,400),{steps:5});await page.mouse.up();assert.equal(await page.locator('.handle.selected').count(),4);await page.mouse.move(...await screen(400,140));await page.mouse.down();await page.mouse.move(...await screen(410,150),{steps:5});await page.mouse.up();assert.equal(await page.locator('.handle.selected').count(),4);
        assert.deepEqual(await page.evaluate(()=>Geometry.parseContours(document.querySelector('.shape').getAttribute('d'))[0]),[[210,150],[610,150],[610,370],[210,370]]);
        assert.deepEqual(errors,[]);console.log((packaged?'Pacote Windows':'Desktop Electron')+': controles anteriores, várias linhas, arraste livre e seleção por área passaram.');
    } finally {await app.close();}
})().catch(e=>{console.error(e);process.exit(1)});
