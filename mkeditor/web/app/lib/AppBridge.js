"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppBridge = void 0;
const electron_1 = require("electron");
const path_1 = require("path");
const AppSession_1 = require("./AppSession");
const AppStorage_1 = require("./AppStorage");
const util_1 = require("../util");
/**
 * AppBridge
 */
class AppBridge {
    /** The browser window */
    context;
    /** The browser window title */
    contextWindowTitle = 'MKEditor';
    /** Flag to determine whether content has changed */
    editorContentHasChanged = false;
    /** Providers to provide functions to the bridge */
    providers = {
        logger: null,
        settings: null,
    };
    /**
     * Create a new AppBridge instance to manage IPC traffic.
     *
     * @param context - the browser window
     * @param register - register all IPC listeners immediately
     * @returns
     */
    constructor(context, register = false) {
        this.context = context;
        if (register) {
            this.register();
        }
    }
    /**
     * Provide access to a provider.
     *
     * @param provider - the provider to access
     * @param instance - the associated provider instance
     * @returns
     */
    provide(provider, instance) {
        this.providers[provider] = instance;
    }
    /**
     * Register all IPC event listeners.
     * @returns
     */
    register() {
        // Enable logging from the renderer context
        electron_1.ipcMain.on('log', (_e, { level, msg, meta }) => {
            const logger = this.providers.logger?.log;
            if (!logger)
                return;
            if (level !== 'error' &&
                level !== 'warn' &&
                level !== 'info' &&
                level !== 'debug') {
                return;
            }
            logger[level](msg, meta);
        });
        // Set the app window title
        electron_1.ipcMain.on('to:title:set', (event, title = null) => {
            this.contextWindowTitle = title ? `MKEditor - ${title}` : 'MKEditor';
            this.setWindowTitle();
        });
        // Set the editor state to track content changes in the main process.
        electron_1.ipcMain.on('to:editor:state', (event, hasChanged) => {
            this.editorContentHasChanged = hasChanged;
            this.setWindowTitle();
        });
        // Save editor settings to file (~/.mkeditor/settings.json)
        electron_1.ipcMain.on('to:settings:save', (event, { settings }) => {
            this.providers.settings?.saveSettingsToFile(settings);
        });
        // Persist the renderer's open-tab / cursor / scroll session. Fired
        // by the renderer's debounced session save trigger (P2) and by the
        // renderer's flush-request handler during quit (P1 stub, P2 real).
        electron_1.ipcMain.on('to:session:save', (_event, payload) => {
            AppSession_1.AppSession.save(payload);
        });
        // Wipe the persisted session file. Fired by the renderer's
        // "Clear saved session" action in the Settings modal.
        electron_1.ipcMain.on('to:session:clear', () => {
            AppSession_1.AppSession.clear();
            this.context.webContents.send('from:notification:display', {
                status: 'success',
                key: 'notifications:session_cleared',
            });
        });
        // Export rendered HTML, triggered from the renderer process
        electron_1.ipcMain.on('to:html:export', (event, { content }) => {
            AppStorage_1.AppStorage.saveFile(this.context, {
                id: event.sender.id,
                data: content,
                encoding: 'utf-8',
            });
        });
        // Export rendered HTML to PDF
        electron_1.ipcMain.on('to:pdf:export', async (event, { content }) => {
            const offscreen = new electron_1.BrowserWindow({
                show: false,
                webPreferences: { offscreen: true },
            });
            AppStorage_1.AppStorage.saveFileToPDF(this.context, offscreen, {
                id: event.sender.id,
                data: content,
                encoding: 'utf-8',
            });
        });
        // Create a new file, linked to the application menu
        electron_1.ipcMain.on('to:file:new', () => {
            AppStorage_1.AppStorage.createNewFile(this.context).then(() => {
                this.setWindowTitle();
            });
        });
        // Open a new file, forwarded from the renderer process
        // via received from:file:open event.
        electron_1.ipcMain.on('to:file:open', () => {
            AppStorage_1.AppStorage.showOpenDialog(this.context);
        });
        electron_1.ipcMain.on('to:folder:open', () => {
            AppStorage_1.AppStorage.openDirectory(this.context);
        });
        electron_1.ipcMain.on('to:file:openpath', (event, { path }) => {
            AppStorage_1.AppStorage.openPath(this.context, path);
        });
        // Save an existing file, this is also used by the renderer bridge "from:file:open" listener, if
        // editor content changes are detected by logic in the renderer process, the renderer bridge will
        // submit a save event to this channel with prompt and fromOpen both defined, otherwise it'll just
        // submit an open event directly to the "to:file:open" channel instead.
        electron_1.ipcMain.on('to:file:save', async (event, { content, file, prompt = false, fromOpen = false, openPath = null, openFile = true, }) => {
            if (await this.promptUserConfirmSave(this.context, prompt)) {
                AppStorage_1.AppStorage.saveFile(this.context, {
                    id: event.sender.id,
                    data: content,
                    filePath: file,
                    encoding: 'utf-8',
                    openFile,
                }).then(() => {
                    if (openPath) {
                        AppStorage_1.AppStorage.openPath(this.context, openPath);
                    }
                    else if (fromOpen) {
                        AppStorage_1.AppStorage.showOpenDialog(this.context);
                    }
                    this.setWindowTitle();
                });
            }
            else {
                if (openPath) {
                    AppStorage_1.AppStorage.openPath(this.context, openPath);
                }
                else if (fromOpen) {
                    AppStorage_1.AppStorage.showOpenDialog(this.context);
                }
            }
        });
        // Save as event, doesn't require checks on "activeFile",
        // this will simply just call AppStorage save and triger
        // the dialog for the user to save the file to the location
        // of their choice.
        electron_1.ipcMain.on('to:file:saveas', (event, data) => {
            AppStorage_1.AppStorage.saveFile(this.context, {
                id: event.sender.id,
                data,
                encoding: 'utf-8',
            }).then(() => {
                this.setWindowTitle();
            });
        });
        electron_1.ipcMain.on('to:file:create', async (_e, { parent, name }) => {
            await AppStorage_1.AppStorage.createFile(this.context, parent, name);
        });
        electron_1.ipcMain.on('to:folder:create', async (_e, { parent, name }) => {
            await AppStorage_1.AppStorage.createFolder(this.context, parent, name);
        });
        electron_1.ipcMain.on('to:file:rename', async (_e, { path, name }) => {
            await AppStorage_1.AppStorage.renamePath(this.context, path, name);
        });
        electron_1.ipcMain.on('to:file:delete', async (_e, { path }) => {
            await AppStorage_1.AppStorage.deletePath(this.context, path);
        });
        electron_1.ipcMain.on('to:file:properties', async (event, { path }) => {
            const info = await AppStorage_1.AppStorage.getPathProperties(path);
            event.sender.send('from:path:properties', info);
        });
        // mked:// protocol handlers
        electron_1.ipcMain.on('mked:get-active-file', (event) => {
            event.returnValue = AppStorage_1.AppStorage.getActiveFilePath();
        });
        // Provide app locale to renderer
        electron_1.ipcMain.on('mked:get-locale', (event) => {
            const locale = this.providers.settings?.getSetting('locale') ??
                (0, util_1.normalizeLanguage)(electron_1.app.getLocale());
            event.returnValue = locale;
        });
        // Provide path resolution through IPC to avoid having to set
        // nodeIntegration to true.
        electron_1.ipcMain.handle('mked:path:dirname', (_e, p) => (0, path_1.dirname)(p));
        electron_1.ipcMain.handle('mked:path:resolve', (_e, base, rel) => (0, path_1.resolve)(base, rel));
        electron_1.ipcMain.on('mked:open-url', (_e, url) => {
            try {
                this.handleMkedUrl(url);
            }
            catch (e) {
                this.providers.logger?.log.error('[mked:open-url]', e);
            }
        });
        // Broadcast language changes to the renderer
        electron_1.ipcMain.on('to:i18n:set', (_e, lng) => {
            try {
                this.context.webContents.send('from:i18n:set', lng);
            }
            catch (e) {
                this.providers.logger?.log.error('[to:i18n:set]', e);
            }
        });
    }
    /**
     * Handle an mked:// URL
     *
     * @param url - the URL
     * @returns
     */
    handleMkedUrl(url) {
        try {
            const parsed = new URL(url);
            if (parsed.hostname === 'open') {
                const path = parsed.searchParams.get('path');
                AppStorage_1.AppStorage.openActiveFile(this.context, path);
            }
        }
        catch {
            this.providers.logger?.log.error(`Malformed path to linked document: ${url}`);
        }
    }
    /**
     * Prompt the user to save.
     *
     * @param context - the browser window
     * @param shouldShowPrompt - disable if true
     * @returns
     */
    async promptUserConfirmSave(context, shouldShowPrompt = true) {
        if (!shouldShowPrompt) {
            return true;
        }
        const check = await electron_1.dialog.showMessageBox(context, {
            type: 'question',
            buttons: ['Yes', 'No'],
            title: 'Save changes',
            message: 'Would you like to save changes to your existing file?',
        });
        return check.response === 0;
    }
    /**
     * Prompt the user to save before quitting the app.
     *
     * @param event - the trigger event
     * @returns
     */
    promptUserBeforeQuit(event) {
        if (this.editorContentHasChanged) {
            return this.displayPrompt(event, 'Confirm', 'You have unsaved changes, are you sure you want to quit?');
        }
    }
    /**
     * Display a user prompt dialog.
     *
     * @param event - the trigger event
     * @param title - the prompt title
     * @param message - the prompt message
     * @returns
     */
    displayPrompt(event, title, message) {
        const choice = electron_1.dialog.showMessageBoxSync(this.context, {
            type: 'question',
            buttons: ['Yes', 'No'],
            title,
            message,
        });
        if (choice) {
            event.preventDefault();
        }
    }
    /**
     * Set the app window title.
     * @returns
     */
    setWindowTitle() {
        const suffix = this.editorContentHasChanged ? ' *' : '';
        this.context.setTitle(`${this.contextWindowTitle}${suffix}`);
    }
}
exports.AppBridge = AppBridge;
