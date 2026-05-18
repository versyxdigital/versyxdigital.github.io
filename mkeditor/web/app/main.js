"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electron_updater_1 = require("electron-updater");
const main_1 = __importDefault(require("electron-log/main"));
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const AppBridge_1 = require("./lib/AppBridge");
const AppMenu_1 = require("./lib/AppMenu");
const AppSession_1 = require("./lib/AppSession");
const AppSettings_1 = require("./lib/AppSettings");
const AppStorage_1 = require("./lib/AppStorage");
const AppWindow_1 = require("./lib/AppWindow");
const icon_1 = require("./assets/icon");
/** --------------------App Logging------------------------------- */
// Set the log path
const logpath = (0, path_1.join)((0, path_1.normalize)((0, os_1.homedir)()), '.mkeditor/main.log');
// Truncate the log file
if ((0, fs_1.existsSync)(logpath)) {
    (0, fs_1.writeFileSync)(logpath, '');
}
// Configure the logger
main_1.default.transports.file.resolvePathFn = () => logpath;
main_1.default.transports.file.level = 'info'; // TODO make this a setting
main_1.default.initialize();
// Define log config to pass to app handlers
const logconfig = { log: main_1.default, logpath };
/** --------------------Auto Updates------------------------------ */
// Configure the auto-update
// NOTE: This does not work for MacOS without code signing and
// other bits... Mac users stuck on manual downloads for now.
electron_updater_1.autoUpdater.logger = main_1.default;
electron_updater_1.autoUpdater.autoDownload = true;
/** --------------------Custom Protocol--------------------------- */
// Register the mked:// protocol scheme for opening linked
// markdown documents in new tabs from within the editor.
electron_1.protocol.registerSchemesAsPrivileged([
    {
        scheme: 'mked',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            bypassCSP: true,
            allowServiceWorkers: false,
        },
    },
]);
/** --------------------App Entry--------------------------------- */
let context;
/**
 * Main entry point for MKEditor app.
 *
 * @param file - present if we are opening the app from a file
 */
function main(file = null) {
    // Pick the window chrome per platform. Windows + Linux become frameless
    // so the renderer's `<TitleBar>` (added in P2) can draw the logo, menu
    // bar, and window-control buttons. macOS keeps the native traffic lights
    // via `titleBarStyle: 'hiddenInset'` and continues to use the system
    // menu bar — `trafficLightPosition` nudges the buttons down so they
    // align with the title row P3 will tune.
    const isMac = process.platform === 'darwin';
    let chrome;
    if (isMac) {
        chrome = {
            titleBarStyle: 'hiddenInset',
            trafficLightPosition: { x: 12, y: 12 },
        };
    }
    else {
        chrome = { frame: false };
    }
    context = new electron_1.BrowserWindow({
        show: false,
        icon: (0, path_1.join)(__dirname, 'assets/icon.ico'),
        ...chrome,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: (0, path_1.join)(__dirname, 'preload.js'),
        },
    });
    // Load the editor frontend
    context.loadFile((0, path_1.join)(__dirname, '../index.html'));
    // Prevent navigation to links within the BrowserWindow. This is usually
    // emitted when a user clicks a link that would cause a full page load.
    // Instead of preventing the app's main window from being redirected, we
    // block it here and then handle links navigation further down below.*
    context.webContents.on('will-navigate', (event) => event.preventDefault());
    // Load the main process settings handler
    const settings = new AppSettings_1.AppSettings(context);
    settings.provide('logger', logconfig);
    // Load the main process "bridge" to handle IPC traffic across
    // execution contexts.
    const bridge = new AppBridge_1.AppBridge(context);
    bridge.provide('settings', settings);
    bridge.provide('logger', logconfig);
    bridge.register(); // Register all IPC event listeners
    // Load the electron application menu. On Windows + Linux this calls
    // `Menu.setApplicationMenu(null)` so the native strip disappears; on
    // macOS it installs the model-driven application menu.
    const menu = new AppMenu_1.AppMenu(context);
    menu.provide('logger', logconfig);
    menu.register(); // Register all menu items
    // Renderer's in-window menu (P2) reaches main-process commands
    // (open-log, toggle-devtools) through this IPC channel — same
    // dispatch table the native macOS menu uses.
    menu.wireRendererCommandBridge();
    // Window-control IPC + maximize-state emitter. The renderer's title bar
    // (P2) sends `to:window:minimize/maximize/close` here; `from:window:state`
    // hydrates the renderer with the initial maximize state on did-finish-load
    // and replays on every maximize/unmaximize.
    const window = new AppWindow_1.AppWindow(context, true);
    void window; // referenced to keep the instance alive alongside `context`
    // Configure the app's tray icon and context menu
    const tray = new electron_1.Tray(electron_1.nativeImage.createFromDataURL((0, icon_1.iconBase64)()));
    tray.setContextMenu(menu.buildTrayContextMenu(context));
    tray.setToolTip('MKEditor');
    tray.setTitle('MKEditor');
    // Register the mked:// protocol for opening linked markdown documents
    // in new tabs from within the editor.*
    electron_1.protocol.handle('mked', (request) => {
        bridge.handleMkedUrl(request.url);
        return new Response(''); // satisfy the protocol
    });
    // Set the window open handler for HTTP(S) URLs.*
    context.webContents.setWindowOpenHandler(({ url }) => {
        electron_1.shell.openExternal(url); // Use the user's default browser
        return { action: 'deny' }; // No new window in main process
    });
    // On finished frotend loading, set the editor theme and settings,
    // and set the active file (untitled new file if no file open).
    context.webContents.on('did-finish-load', () => {
        if (context) {
            if (settings.applied && settings.applied.systemtheme) {
                context.webContents.send('from:theme:set', electron_1.nativeTheme.shouldUseDarkColors);
            }
            else {
                context.webContents.send('from:theme:set', settings.applied?.darkmode);
            }
            context.webContents.send('from:settings:set', settings.loadFile());
            const sessionEnabled = settings.applied?.sessionRestore ?? true;
            context.webContents.send('from:session:restore', sessionEnabled
                ? AppSession_1.AppSession.buildRestoreEnvelope(AppSession_1.AppSession.load())
                : { session: null, missing: [], contents: {} });
            AppStorage_1.AppStorage.openActiveFile(context, file);
        }
    });
    context.on('close', (event) => {
        bridge.promptUserBeforeQuit(event);
    });
    context.on('closed', () => {
        context = null;
    });
    context.maximize();
    context.show();
}
/** --------------------App Lifecycle ---------------------------- */
// If the app is already running then handle it.
if (!electron_1.app.requestSingleInstanceLock()) {
    electron_1.app.quit();
}
else {
    electron_1.app.on('second-instance', (event, args) => {
        console.log({ event, args });
        electron_1.app.focus();
        // If user has opened the app via a file, then set active file.
        if (args.length >= 2) {
            const filepath = args.find((arg) => arg.toLowerCase().endsWith('.md'));
            if (context && filepath)
                AppStorage_1.AppStorage.openPath(context, filepath);
        }
    });
}
electron_1.app.on('ready', () => {
    electron_updater_1.autoUpdater.checkForUpdatesAndNotify();
    let file = null;
    if (process.platform === 'win32' && process.argv.length >= 2) {
        file = process.argv[1];
    }
    main(file);
});
electron_updater_1.autoUpdater.on('update-available', async (event) => {
    context?.webContents.send('from:notification:display', {
        status: 'info',
        key: 'notifications:update_available',
        values: { version: event.version },
    });
});
electron_updater_1.autoUpdater.on('update-downloaded', async (event) => {
    context?.webContents.send('from:notification:display', {
        status: 'success',
        key: 'notifications:update_downloaded',
        values: { version: event.version },
    });
});
// Mainly MacOS...
electron_1.app.on('activate', () => {
    if (!context) {
        main();
    }
});
// MacOS - open with... Also handle files using the same runnning instance
electron_1.app.on('open-file', (event) => {
    event.preventDefault();
    let file = null;
    if (process.platform === 'win32' && process.argv.length >= 2) {
        file = process.argv[1];
    }
    if (!context) {
        main(file);
    }
    else {
        AppStorage_1.AppStorage.openActiveFile(context, file);
    }
});
/**
 * Final session flush on quit. Asks the renderer to send one last
 * `to:session:save` (so the at-quit cursor position of the active tab
 * lands on disk), waits up to ~250 ms for it to arrive, and then
 * proceeds with quit either way. The renderer's debounced save covers
 * everything else, so a missed ack just means the very last cursor
 * movement isn't persisted — not data loss.
 */
let isFlushingSession = false;
electron_1.app.on('before-quit', (event) => {
    if (isFlushingSession)
        return; // second pass after our own app.quit()
    if (!context || context.isDestroyed())
        return;
    event.preventDefault();
    isFlushingSession = true;
    let done = false;
    const finish = () => {
        if (done)
            return;
        done = true;
        electron_1.ipcMain.removeListener('to:session:save', onAck);
        electron_1.app.quit();
    };
    const onAck = () => finish();
    electron_1.ipcMain.on('to:session:save', onAck);
    context.webContents.send('from:session:flush-request');
    setTimeout(finish, 250);
});
electron_1.app.on('window-all-closed', () => {
    electron_1.app.clearRecentDocuments(); // TODO get recent documents working or remove
    electron_1.app.quit();
});
