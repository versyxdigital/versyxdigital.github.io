"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Preload script.
 *
 * Main Bridge: AppBridge
 * Renderer Bridge: Bridge
 *
 * The contextBridge module provides a safe, bi-directional, synchronous
 * bridge across the isolated contexts.
 */
const electron_1 = require("electron");
// Can be sent from the renderer process and
// received by the main process
const senderWhitelist = [
    'to:title:set',
    'to:editor:state',
    'to:settings:save',
    'to:session:save',
    'to:session:clear',
    'to:html:export',
    'to:pdf:export',
    'to:file:new',
    'to:file:open',
    'to:folder:open',
    'to:file:save',
    'to:file:saveas',
    'to:file:openpath',
    'to:file:create',
    'to:folder:create',
    'to:file:rename',
    'to:file:delete',
    'to:file:properties',
    'to:i18n:set',
    'to:workspace:set',
    'to:window:minimize',
    'to:window:maximize',
    'to:window:close',
    'to:window:fullscreen',
    'to:command:run',
    'to:edit:cut',
    'to:edit:copy',
    'to:edit:paste',
    // AI Assistant — chat / config / keys / Ollama
    'to:ai:chat',
    'to:ai:cancel',
    'to:ai:tool-result',
    'to:ai:config:get',
    'to:ai:config:set',
    'to:ai:key:set',
    'to:ai:key:clear',
    'to:ai:ollama:list',
    // AI Assistant — conversation persistence
    'to:ai:conversations:save',
    'to:ai:conversations:flush',
];
// Can be sent from the main process and received
// by the renderer process
const receiverWhitelist = [
    'from:theme:set',
    'from:settings:set',
    'from:session:restore',
    'from:session:flush-request',
    'from:file:new',
    'from:file:open',
    'from:folder:open',
    'from:folder:opened',
    'from:file:opened',
    'from:file:save',
    'from:file:saveas',
    'from:modal:open',
    'from:command:palette',
    'from:notification:display',
    'from:path:properties',
    'from:path:renamed',
    'from:i18n:set',
    'from:window:state',
    // AI Assistant — streaming chunks / tool calls / done / error / config
    'from:ai:chunk',
    'from:ai:tool-call',
    'from:ai:done',
    'from:ai:error',
    'from:ai:config',
    'from:ai:ollama:models',
    // AI Assistant — conversation persistence
    'from:ai:conversations',
    'from:ai:conversations:flush-request',
    // AI Assistant — application menu / tray sidebar toggle
    'from:assistant:toggle',
];
/**
 * contextBridgeChannel utilises the ipcRenderer module to provide methods for
 * sending synchronous and asynchronous messages accross different execution contexts
 * (i.e. from the renderer process to the main process.).
 */
const contextBridgeChannel = () => {
    return {
        send: (channel, data) => {
            if (senderWhitelist.includes(channel)) {
                // Send an async message to te main process via whitelisted channel,
                // along with data.
                //
                // Note, arguments will be serialized with the structured clone algorithm,
                // so prototype chains will not be included. Sending functions, promises,
                // symbols, weakmaps, weaksets or DOM objects will throw an exception.
                electron_1.ipcRenderer.send(channel, data);
            }
        },
        receive: (channel, fn) => {
            if (receiverWhitelist.includes(channel)) {
                // Listen to channels and execute callack when messages are received.
                electron_1.ipcRenderer.on(channel, (event, ...args) => {
                    fn(...args);
                });
            }
        },
    };
};
/**
 * The "Main World" is the JavaScript context that the main renderer code runs in.
 *
 * When contextIsolation is enabled in webPreferences, the preload scripts run in an
 * "Isolated World" that is exposed to the "Main World" through the contextBridge.
 *
 * Docs: https://electronjs.org/docs/api/context-bridge
 */
electron_1.contextBridge.exposeInMainWorld('executionBridge', contextBridgeChannel());
electron_1.contextBridge.exposeInMainWorld('mked', {
    // Pinned at preload time: `process.platform` is authoritative here (the
    // preload runs in Node), avoiding a renderer-side UA sniff. Read once
    // by the composition root in `index.ts` and threaded through Managers.
    platform: process.platform,
    getActiveFilePath: () => electron_1.ipcRenderer.sendSync('mked:get-active-file'),
    getAppLocale: () => electron_1.ipcRenderer.sendSync('mked:get-locale'),
    /**
     * SPKI base64 of main's per-session RSA-OAEP public key. The
     * renderer imports this via Web Crypto and uses it to encrypt
     * any secret (today: AI provider API keys) before sending over
     * IPC. Synchronous because we want the very first key-set call
     * to succeed without an awaited round-trip. The public key is
     * not a secret — no compliance issue with how it crosses.
     */
    secureChannelPublicKey: () => electron_1.ipcRenderer.sendSync('mked:secure:public-key'),
    openMkedUrl: (url) => electron_1.ipcRenderer.send('mked:open-url', url),
    pathDirname: (p) => electron_1.ipcRenderer.invoke('mked:path:dirname', p),
    resolvePath: (base, rel) => electron_1.ipcRenderer.invoke('mked:path:resolve', base, rel),
    /**
     * Read a file's contents without opening it as a tab. Used by the
     * AI assistant's `read_file` tool when the requested file isn't
     * already open — keeps tab-spam down when the agent is gathering
     * context across many files.
     */
    readFile: (path) => electron_1.ipcRenderer.invoke('mked:fs:readfile', path),
    /**
     * Write `content` to an existing or new file at `path`. Resolves
     * with `{ok: true, path}` on success or `{ok: false, error}` on
     * failure — used by the AI assistant's write-class tools so they
     * can report honest success/failure to the agent (the fire-and-
     * forget `to:file:save` channel used by the menu UI returns
     * nothing). Parent directories are created on demand.
     */
    saveFile: (path, content) => electron_1.ipcRenderer.invoke('mked:fs:savefile', path, content),
    /**
     * Create a new file at `parent/name` with `content`. Resolves with
     * `{ok: true, path}` on success or `{ok: false, error}` on failure.
     * Parent directories are created on demand. Used by the AI
     * assistant's `create_file` tool; the menu-driven flow continues
     * to use the existing fire-and-forget `to:file:create` channel.
     */
    createFile: (parent, name, content) => electron_1.ipcRenderer.invoke('mked:fs:createfile', parent, name, content),
    /**
     * Create a new (empty) directory at `parent/name`. Resolves with
     * `{ok: true, path}` on success or `{ok: false, error}` on
     * failure. Used by the AI assistant's `create_folder` tool so the
     * agent can make empty directories visible in the explorer
     * without resorting to placeholder `.gitkeep` files.
     */
    createFolder: (parent, name) => electron_1.ipcRenderer.invoke('mked:fs:createfolder', parent, name),
});
electron_1.contextBridge.exposeInMainWorld('logger', {
    log(level, msg, meta) {
        electron_1.ipcRenderer.send('log', { level, msg, meta });
    },
    debug(msg, meta) {
        electron_1.ipcRenderer.send('log', { level: 'debug', msg, meta });
    },
    info(msg, meta) {
        electron_1.ipcRenderer.send('log', { level: 'info', msg, meta });
    },
    warn(msg, meta) {
        electron_1.ipcRenderer.send('log', { level: 'warn', msg, meta });
    },
    error(msg, meta) {
        electron_1.ipcRenderer.send('log', { level: 'error', msg, meta });
    },
});
