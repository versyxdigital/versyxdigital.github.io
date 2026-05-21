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
const AppAssistant_1 = require("./lib/AppAssistant");
const AppBridge_1 = require("./lib/AppBridge");
const AppMenu_1 = require("./lib/AppMenu");
const AppSession_1 = require("./lib/AppSession");
const AppSettings_1 = require("./lib/AppSettings");
const AppStorage_1 = require("./lib/AppStorage");
const AppWindow_1 = require("./lib/AppWindow");
const quitFlush_1 = require("./lib/quitFlush");
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
    // so the renderer's `<TitleBar>` can draw the logo, menu bar, and
    // window-control buttons. macOS keeps the native traffic lights via
    // `titleBarStyle: 'hiddenInset'` and continues to use the system menu
    // bar — `trafficLightPosition` nudges the buttons down so they align
    // with the title row P3 will tune.
    const isMac = process.platform === 'darwin';
    let chrome;
    if (isMac) {
        chrome = {
            titleBarStyle: 'hiddenInset',
            trafficLightPosition: { x: 12, y: 12 },
        };
    }
    else {
        // Windows + Linux: frameless so the renderer-drawn `<TitleBar>`
        // owns the chrome; `autoHideMenuBar` is belt-and-braces (some
        // window managers — and certain Electron versions on Linux —
        // can still try to render a menu strip inside the client area
        // even when `frame: false` should suppress it). The Electron
        // application menu IS still installed (see AppMenu.register())
        // so global accelerators like Ctrl+S keep working; only the
        // menu bar UI is suppressed.
        chrome = { frame: false, autoHideMenuBar: true };
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
    // Hard-suppress the menu bar on Windows + Linux. With
    // `autoHideMenuBar` alone, pressing Alt can momentarily reveal the
    // menu (a default Electron UX) which would conflict with the
    // TitleBar's own Alt-to-focus-first-menu handling. Explicitly
    // setting visibility to false keeps the menu purely functional
    // (accelerators) without any UI presence.
    if (!isMac) {
        context.setMenuBarVisibility(false);
    }
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
    // AI Assistant — service the bridge delegates `to:ai:*` to. The SDK
    // clients and `safeStorage`-encrypted keys live entirely inside this
    // instance; the renderer reaches it only through the IPC surface
    // AppBridge whitelists.
    const assistant = new AppAssistant_1.AppAssistant(context);
    bridge.provide('assistant', assistant);
    bridge.register(); // Register all IPC event listeners
    // Load the electron application menu. macOS uses it for the system
    // menu bar; Windows + Linux install the same template too — even
    // though the menu bar is hidden (see chrome opts above), Electron
    // still dispatches accelerators (Ctrl+S, Ctrl+O, etc.) from it, so
    // the keybindings the in-window `<TitleBar>` advertises actually
    // work.
    const menu = new AppMenu_1.AppMenu(context);
    menu.provide('logger', logconfig);
    menu.register(); // Register all menu items
    // Renderer's in-window TitleBar menu reaches main-process commands
    // (open-log, toggle-devtools) through this IPC channel — same
    // dispatch table the native macOS menu uses.
    menu.wireRendererCommandBridge();
    // Window-control IPC + maximize-state emitter. The renderer's title
    // bar sends `to:window:minimize/maximize/close` here; `from:window:state`
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
            context.webContents.send('from:theme:set', electron_1.nativeTheme.shouldUseDarkColors);
            context.webContents.send('from:settings:set', settings.loadFile());
            const sessionEnabled = settings.applied?.sessionRestore ?? true;
            context.webContents.send('from:session:restore', sessionEnabled
                ? AppSession_1.AppSession.buildRestoreEnvelope(AppSession_1.AppSession.load())
                : { session: null, missing: [], contents: {} });
            // Hydrate the renderer with the sanitized AI Assistant config.
            // The payload exposes per-provider `hasKey: boolean` only —
            // never the key value. AssistantManager uses this to decide
            // which provider tabs to show.
            bridge.pushAssistantConfig();
            // Hydrate the renderer with persisted conversation history.
            // Goes second (after config) so AssistantManager exists and is
            // wired before `restore()` is called from the channel handler.
            bridge.pushPersistedConversations();
            AppStorage_1.AppStorage.openActiveFile(context, file);
        }
    });
    const handleNativeThemeUpdated = () => {
        if (!context || context.isDestroyed())
            return;
        if (!settings.applied?.systemtheme)
            return;
        context.webContents.send('from:theme:set', electron_1.nativeTheme.shouldUseDarkColors);
    };
    electron_1.nativeTheme.on('updated', handleNativeThemeUpdated);
    context.on('close', (event) => {
        bridge.promptUserBeforeQuit(event);
    });
    context.on('closed', () => {
        electron_1.nativeTheme.off('updated', handleNativeThemeUpdated);
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
    // Two flush requests fan out in parallel — session (FileManager
    // tabs + cursor) and AI conversations. We resolve when BOTH ack
    // OR the 250ms safety timeout fires. Missing one ack just costs
    // a few hundred ms of unpersisted activity, not data loss; the
    // renderer's debounced saves cover everything else. Logic lives
    // in `quitFlush.ts` so it can be unit-tested without spinning up
    // Electron's app lifecycle.
    (0, quitFlush_1.runQuitFlush)({
        on: (channel, listener) => electron_1.ipcMain.on(channel, listener),
        off: (channel, listener) => electron_1.ipcMain.removeListener(channel, listener),
        send: (channel, payload) => {
            if (!context || context.isDestroyed())
                return;
            // `from:session:flush-request` historically went without a
            // payload; preserve that signature for the renderer.
            if (payload === undefined)
                context.webContents.send(channel);
            else
                context.webContents.send(channel, payload);
        },
        onDone: () => electron_1.app.quit(),
    });
});
electron_1.app.on('window-all-closed', () => {
    electron_1.app.clearRecentDocuments(); // TODO get recent documents working or remove
    electron_1.app.quit();
});
