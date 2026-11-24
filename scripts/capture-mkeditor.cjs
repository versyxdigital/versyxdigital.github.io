/** Real production UI with an isolated, illustrative demo workspace. No live accounts. */
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(process.env.MKEDITOR_SOURCE_ROOT || path.join(__dirname, '../../mkeditor'));
const outputRoot = path.resolve(process.env.MKEDITOR_CAPTURE_DIR || path.join(__dirname, '../qa-screens/mkeditor-captures'));
const shots = path.join(outputRoot, 'originals');
fs.mkdirSync(shots, { recursive: true });
app.setPath('userData', path.join(outputRoot, 'profile'));
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});
require.extensions['.ts'] = (module, filename) => module._compile(require(path.join(root, 'node_modules/typescript')).transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: 1, target: 9 } }).outputText, filename);
const { driveFixture } = require(path.join(root, 'tests/fixtures/driveServer.ts'));
const { CloudService } = require(path.join(root, 'dist/app/lib/cloud/CloudService'));
const { GoogleDrive } = require(path.join(root, 'dist/app/lib/cloud/GoogleDrive'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const workspace = 'C:/Fieldnotes';
const document = [
  '# Fieldnotes', '', 'A notebook for ideas worth coming back to.', '',
  '## From a thought to a first draft', '',
  'Good ideas rarely arrive fully formed. Give them a little space,',
  'a useful heading, and somewhere to grow.', '',
  '::: primary', '**A useful starting point**', 'Start with the thought. Find the right words as you go.', ':::', '',
  '## On the desk this week', '',
  '| Document | Next step | Status |',
  '| :--- | :--- | :--- |',
  '| Launch notes | Review the introduction | In progress |',
  '| Writing guide | Add a few examples | Draft |',
  '| Reading list | Collect useful references | Ready |', '',
  '## A small writing ritual', '',
  '- Gather the notes in one place',
  '- Find a useful structure',
  '- Leave a little room for a better idea', '',
  '### Keep the useful things close', '',
  'Write a paragraph. Follow a link. Make a list. Your next draft',
  'starts with what is already on the page.', '',
  '```typescript', "const notebook = { title: 'Fieldnotes', format: 'markdown' };",
  '```',
].join('\n');
const launch = ['# Launch notes', '', 'A few thoughtful changes, ready to share.', '', '## What is new', '', '- A quieter, more compact workspace', '- A clearer way to move between documents', '- More room for the words on the page', '', '## Before we share', '', '- Finish the first draft', '- Review the screenshots', '- Check links and examples', '', '::: primary', 'Keep the release notes short, useful, and easy to scan.', ':::', '', '## The next draft', '', 'Start with what changed. Explain why it helps. Give the reader', 'one clear next step.'].join('\n');
const files = { [`${workspace}/README.md`]: document, [`${workspace}/Launch notes.md`]: launch, [`${workspace}/Writing guide.md`]: '# Writing guide\n\nMake every heading earn its place.\n', [`${workspace}/Reading list.md`]: '# Reading list\n\nA few references for the next draft.\n' };
let win, fixture, service;
const js = async code => { try { return await win.webContents.executeJavaScript(code, true); } catch(error) { throw Error(error.message + ': ' + code); } };
async function wait(code) { for (let n = 0; n < 100; n++) { if (await js(code)) return; await pause(100); } await capture('debug-current');console.log(await js(`document.body.innerText.slice(0,1600)`));throw Error('Timed out: '+code); }
async function click(label) { await js(`(()=>{const node=[...document.querySelectorAll('button')].find(node=>node.getAttribute('aria-label')===${JSON.stringify(label)}||node.textContent.trim()===${JSON.stringify(label)});if(!node)throw Error('Missing action');if(node.getAttribute('aria-haspopup')==='menu'){node.focus();node.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));}else node.click();})()`);await pause(250); }
async function capture(name) { await pause(450);const shot=await win.webContents.debugger.sendCommand('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true});const data=Buffer.from(shot.data,'base64');fs.writeFileSync(path.join(shots,name+'.png'),data);console.log(`${name}: ${data.readUInt32BE(16)} x ${data.readUInt32BE(20)}`); }
async function assistant(open) {const active=await js(`document.querySelector('#assistant-toggle')?.getAttribute('aria-pressed')==='true'`);if(active!==open)await click('Toggle AI Assistant');}
async function closeModal(){await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await wait(`!document.querySelector('[role=dialog]')`);}
const providerConfig = connected => ({ encryptionAvailable:true, config:{anthropic:{enabled:true,hasKey:false,defaultModel:'claude-sonnet-4-6'},openai:{enabled:true,hasKey:false,defaultModel:'gpt-5'},ollama:{enabled:true,hasKey:false,defaultModel:'llama3.2',baseUrl:'http://localhost:11434',contextLength:32768}},chatgpt:{mode:'chatgpt',signingIn:false,connected,planEnabled:connected,activeId:connected?'demo':undefined,accounts:connected?[{id:'demo',label:'Demo workspace'}]:[],models:[{id:'gpt-5',label:'GPT-5'}],welcome:false}});
app.whenReady().then(async()=>{
  fixture=await driveFixture();fixture.state.content=launch;
  const metadata=(id,name,mimeType='text/markdown')=>({id,name,mimeType,version:fixture.state.revision,headRevisionId:`content-${fixture.state.revision}`,md5Checksum:crypto.createHash('md5').update(fixture.state.content).digest('hex'),parents:['root'],size:String(Buffer.byteLength(fixture.state.content)),capabilities:{canEdit:true,canModifyContent:true,canAddChildren:true}});
  fixture.state.override=(url,res)=>{let value;if(url.pathname==='/drive/v3/files')value={files:[metadata('docs','Documents','application/vnd.google-apps.folder'),metadata('archive','Archive','application/vnd.google-apps.folder'),metadata('markdown','Launch notes.md'),metadata('guide','Writing guide.md'),metadata('reading','Reading list.md')]};if(url.pathname==='/drive/v3/files/markdown'&&!url.searchParams.has('alt'))value=metadata('markdown','Launch notes.md');if(!value)return false;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return true;};
  let entries=[{id:'demo-drive',name:'My Drive',clientId:'demo.apps.googleusercontent.com',clientValue:'',status:'connected',accountId:'account-a',accountName:'Demo workspace',writeAccess:true,credential:JSON.stringify({access:'fixture-access',refresh:'fixture-refresh',expires:Date.now()+3600000,scopes:['https://www.googleapis.com/auth/drive.readonly','https://www.googleapis.com/auth/drive']})}];
  service=new CloudService({load:()=>entries,save:next=>{entries=next;},available:async()=>true,encrypt:async value=>JSON.stringify(value),decrypt:async value=>JSON.parse(value)},async()=>{throw Error('Live sign-in disabled in screenshot session');},state=>{if(win&&!win.isDestroyed())win.webContents.send('from:cloud:state',state);},new GoogleDrive(fixture.endpoints));
  ipcMain.on('to:cloud:request',async(event,request)=>{const response=await service.handle(request);if(!event.sender.isDestroyed())event.sender.send('from:cloud:result',response);});
  for(const [channel,value]of[['mked:get-locale','en'],['mked:get-active-file',null],['mked:secure:public-key','']])ipcMain.on(channel,event=>{event.returnValue=value;});
  ipcMain.handle('mked:path:dirname',(_event,value)=>path.dirname(value));
  ipcMain.handle('mked:fs:readfile',(_event,{path:file})=>files[file]??'');
  ipcMain.on('to:file:openpath',(_event,{path:file})=>{if(files[file])win.webContents.send('from:file:opened',{file,content:files[file]});});
  win=new BrowserWindow({show:false,frame:false,useContentSize:true,width:1600,height:1000,webPreferences:{offscreen:true,contextIsolation:true,nodeIntegration:false,preload:path.join(root,'dist/app/preload.js')}});
  win.webContents.debugger.attach('1.3');
  await win.loadFile(path.join(root,'dist/index.html'));
  await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:2,mobile:false});
  await wait(`Boolean(document.querySelector('.monaco-editor'))&&getComputedStyle(document.querySelector('#react-root')).opacity==='1'`);
  win.webContents.send('from:settings:set',{autoindent:true,darkmode:true,wordwrap:true,whitespace:false,minimap:true,systemtheme:true,scrollsync:true,sessionRestore:true,locale:'en',fileExplorer:{extensions:['md']},pasteImages:{directory:'./assets'},exportSettings:{withStyles:true,container:'container-fluid',fontSize:16,lineSpacing:1.7,background:'#ffffff',fontColor:'#202124'}});
  win.webContents.send('from:theme:set',true);
  const tree=[{type:'directory',name:'Drafts',path:workspace+'/Drafts',hasChildren:true,loaded:true,children:[]},{type:'directory',name:'References',path:workspace+'/References',hasChildren:true,loaded:true,children:[]},...Object.keys(files).map(file=>({type:'file',name:path.basename(file),path:file}))];
  win.webContents.send('from:folder:opened',{tree,path:workspace,workspaceChange:true});
  win.webContents.send('from:file:opened',{file:workspace+'/Launch notes.md',content:launch});
  win.webContents.send('from:file:opened',{file:workspace+'/README.md',content:document});
  win.webContents.send('from:ai:config',providerConfig(true));
  await wait(`document.querySelector('#active-file').textContent.includes('README.md')`);
  if(await js(`(document.querySelector('#sidebar')?.getBoundingClientRect().width??0)<100`))await click('Toggle sidebar');
  await capture('editor-dark');
  win.webContents.send('from:theme:set',false);
  await capture('editor-light');
  win.webContents.send('from:theme:set',true);
  const now=Date.now();
  win.webContents.send('from:ai:conversations',{activeProvider:'openai',activeConversation:{anthropic:null,openai:'demo-review',ollama:null},conversations:{anthropic:[],ollama:[],openai:[{id:'demo-review',providerId:'openai',title:'Review the launch notes',model:'gpt-5',messages:[{id:'demo-user',role:'user',content:'Help me turn the launch notes into a short review checklist.',status:'complete',createdAt:now},{id:'demo-assistant',role:'assistant',content:'Here is a focused checklist for the next pass:\n\n### Before you share\n\n- [ ] Lead with the most useful change\n- [ ] Explain what it means for the reader\n- [ ] Check the examples and links\n- [ ] Read the introduction aloud\n\nKeep the release notes easy to scan, and give each change one clear sentence.',status:'complete',createdAt:now+1}],autoAcceptWrites:false,shareActiveFile:true,shareSelection:false,mentions:[],createdAt:now,updatedAt:now+1}]},drafts:{}});
  await assistant(true);
  const grip=await js(`(()=>{const r=document.querySelector('[data-testid=assistant-resizer]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+150};})()`);
  await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mousePressed',x:grip.x,y:grip.y,button:'left',clickCount:1});
  await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',x:grip.x-220,y:grip.y,button:'left',buttons:1});
  await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',x:grip.x-220,y:grip.y,button:'left',clickCount:1});
  await js(`[...document.querySelectorAll('#assistant-sidebar [role=tab]')].find(node=>node.textContent.trim()==='OpenAI').click()`);
  await wait(`document.querySelector('#assistant-sidebar')?.textContent.includes('review checklist')`);
  await capture('assistant');
  await assistant(false);
  win.webContents.send('from:modal:open',{modal:'settings',tab:'assistant'});
  win.webContents.send('from:ai:config',providerConfig(false));
  await wait(`document.querySelector('[role=dialog]')?.textContent.includes('Continue with ChatGPT')`);
  await capture('providers');
  await closeModal();
  win.webContents.send('from:modal:open','settings');
  await wait(`Boolean(document.querySelector('[role=dialog]'))`);
  await capture('preferences');await closeModal();
  win.webContents.send('from:modal:open','exportSettings');
  await wait(`Boolean(document.querySelector('[role=dialog]'))`);
  await capture('export');await closeModal();
  win.webContents.send('from:modal:open','shortcuts');
  await wait(`Boolean(document.querySelector('[role=dialog]'))`);
  await capture('shortcuts');await closeModal();
  await js(`document.querySelector('nav [role=combobox]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',code:'ArrowDown',bubbles:true}))`);
  await wait(`document.querySelectorAll('[role=option]').length>1`);
  await js(`[...document.querySelectorAll('[role=option]')].find(node=>node.textContent.includes('My Drive')).dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}))`);
  await wait(`[...document.querySelectorAll('#sidebar button')].some(node=>node.textContent==='Launch notes.md')`);
  await js(`[...document.querySelectorAll('#sidebar button')].find(node=>node.textContent==='Launch notes.md').click()`);
  await wait(`Boolean(document.querySelector('nav [aria-label="Google Drive document actions"]'))`);
  await capture('google-drive');
  fixture.state.content=launch.replace('A few thoughtful changes, ready to share.','A few thoughtful changes, reviewed and ready to share.');fixture.state.revision=String(Number(fixture.state.revision)+1);
  await js(`document.querySelector('.monaco-editor textarea, .monaco-editor [contenteditable], .monaco-editor .native-edit-context, .monaco-editor [role=textbox]').focus()`);
  await win.webContents.debugger.sendCommand('Input.insertText',{text:'Notes from the final review.\n\n'});
  win.webContents.send('from:file:save');
  await wait(`Boolean(document.querySelector('#workspace-pane [role=status]'))`);
  await click('Compare with Drive');
  await wait(`Boolean(document.querySelector('.monaco-diff-editor'))`);
  await capture('recovery');
  console.log('Captured nine production UI views. Demo content and public connection state are illustrative; no live credentials or provider requests were used.');
}).catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{service?.dispose();if(win&&!win.isDestroyed())win.destroy();await fixture?.close();app.exit(process.exitCode||0);});
