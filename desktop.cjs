const {app,BrowserWindow,session}=require('electron');
const path=require('node:path');
// Retain the previous local profile when changing the product name.
app.setPath('userData', process.argv.includes('--test-hidden')
    ? path.join(app.getPath('temp'), 'svg-editor-generator-test-profile')
    : path.join(app.getPath('appData'), 'sci-fi-svg-lab'));
function create(){const win=new BrowserWindow({width:1440,height:940,minWidth:980,minHeight:700,backgroundColor:'#101114',title:'SVG Editor Generator',show:!process.argv.includes('--test-hidden'),autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());win.loadFile(path.join(__dirname,'index.html'));}
app.whenReady().then(()=>{session.defaultSession.setPermissionRequestHandler((_w,_p,cb)=>cb(false));create();app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)create()})});app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
