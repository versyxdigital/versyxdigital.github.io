"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppBridge = void 0;
const electron_1 = require("electron");
const fs_1 = require("fs");
const path_1 = require("path");
const AppSession_1 = require("./AppSession");
const AppStorage_1 = require("./AppStorage");
const AssistantConfig_1 = require("./AssistantConfig");
const AssistantKeyStore_1 = require("./AssistantKeyStore");
const SecureChannel_1 = require("./SecureChannel");
const assistantStoreFile_1 = require("./assistantStoreFile");
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
        assistant: null,
    };
    /**
     * RSA keypair used to receive secrets (API keys today, anything
     * else later) without their plaintext ever crossing the IPC
     * boundary. See `SecureChannel` for the rationale.
     */
    secureChannel = new SecureChannel_1.SecureChannel();
    /**
     * IPC listener hygiene. Every `ipcMain.on` registration is process-
     * global, so on macOS where `app.on('activate')` rebuilds the window
     * after it's been closed, listeners would otherwise accumulate across
     * recreations and dispatch on the wrong (destroyed) BrowserWindow.
     */
    listeners = [];
    invokeChannels = [];
    disposed = false;
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
        this.on('log', (_e, { level, msg, meta }) => {
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
        this.on('to:title:set', (event, title = null) => {
            this.contextWindowTitle = title ? `MKEditor - ${title}` : 'MKEditor';
            this.setWindowTitle();
        });
        // Set the editor state to track content changes in the main process.
        this.on('to:editor:state', (event, hasChanged) => {
            this.editorContentHasChanged = hasChanged;
            this.setWindowTitle();
        });
        // Save editor settings to file (~/.mkeditor/settings.json)
        this.on('to:settings:save', (event, { settings }) => {
            this.providers.settings?.saveSettingsToFile(settings);
        });
        // Persist the renderer's open-tab / cursor / scroll session. Fired
        // by the renderer's debounced session save trigger and by the
        // renderer's flush-request handler during quit.
        this.on('to:session:save', (_event, payload) => {
            AppSession_1.AppSession.save(payload);
        });
        // Wipe the persisted session file. Fired by the renderer's
        // "Clear saved session" action in the Settings modal.
        this.on('to:session:clear', () => {
            AppSession_1.AppSession.clear();
            this.context.webContents.send('from:notification:display', {
                status: 'success',
                key: 'notifications:session_cleared',
            });
        });
        // Export rendered HTML, triggered from the renderer process
        this.on('to:html:export', (event, { content }) => {
            AppStorage_1.AppStorage.saveFile(this.context, {
                id: event.sender.id,
                data: content,
                encoding: 'utf-8',
            });
        });
        // Export rendered HTML to PDF
        this.on('to:pdf:export', async (event, { content }) => {
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
        this.on('to:file:new', () => {
            AppStorage_1.AppStorage.createNewFile(this.context).then(() => {
                this.setWindowTitle();
            });
        });
        // Open a new file, forwarded from the renderer process
        // via received from:file:open event.
        this.on('to:file:open', () => {
            AppStorage_1.AppStorage.showOpenDialog(this.context);
        });
        this.on('to:folder:open', () => {
            AppStorage_1.AppStorage.openDirectory(this.context);
        });
        this.on('to:file:openpath', (event, { path }) => {
            AppStorage_1.AppStorage.openPath(this.context, path);
        });
        // Save an existing file, this is also used by the renderer bridge "from:file:open" listener, if
        // editor content changes are detected by logic in the renderer process, the renderer bridge will
        // submit a save event to this channel with prompt and fromOpen both defined, otherwise it'll just
        // submit an open event directly to the "to:file:open" channel instead.
        this.on('to:file:save', async (event, { content, file, prompt = false, fromOpen = false, openPath = null, openFile = true, }) => {
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
        this.on('to:file:saveas', (event, data) => {
            AppStorage_1.AppStorage.saveFile(this.context, {
                id: event.sender.id,
                data,
                encoding: 'utf-8',
            }).then(() => {
                this.setWindowTitle();
            });
        });
        this.on('to:file:create', async (_e, { parent, name, content, }) => {
            // Fire-and-forget channel used by the menu UI — convert
            // `AppStorage.createFile`'s structured result back into a
            // toast (it used to do this itself before being made honest
            // for the AI assistant's invoke path).
            const result = await AppStorage_1.AppStorage.createFile(this.context, parent, name, content);
            this.context.webContents.send('from:notification:display', {
                status: result.ok ? 'success' : 'error',
                key: result.ok
                    ? 'notifications:file_created'
                    : 'notifications:unable_create_file',
            });
        });
        this.on('to:folder:create', async (_e, { parent, name }) => {
            // Fire-and-forget channel used by the menu UI — convert
            // `AppStorage.createFolder`'s structured result back into a
            // toast (it used to do this itself before being made honest
            // for the AI assistant's invoke path).
            const result = await AppStorage_1.AppStorage.createFolder(this.context, parent, name);
            this.context.webContents.send('from:notification:display', {
                status: result.ok ? 'success' : 'error',
                key: result.ok
                    ? 'notifications:folder_created'
                    : 'notifications:unable_create_folder',
            });
        });
        this.on('to:file:rename', async (_e, { path, name }) => {
            await AppStorage_1.AppStorage.renamePath(this.context, path, name);
        });
        this.on('to:file:delete', async (_e, { path }) => {
            await AppStorage_1.AppStorage.deletePath(this.context, path);
        });
        this.on('to:file:properties', async (event, { path }) => {
            const info = await AppStorage_1.AppStorage.getPathProperties(path);
            event.sender.send('from:path:properties', info);
        });
        // mked:// protocol handlers
        this.onSync('mked:get-active-file', (event) => {
            event.returnValue = AppStorage_1.AppStorage.getActiveFilePath();
        });
        // Provide app locale to renderer
        this.onSync('mked:get-locale', (event) => {
            const locale = this.providers.settings?.getSetting('locale') ??
                (0, util_1.normalizeLanguage)(electron_1.app.getLocale());
            event.returnValue = locale;
        });
        // Hand the renderer the SPKI base64 public key for this app
        // session.
        this.onSync('mked:secure:public-key', (event) => {
            event.returnValue = this.secureChannel.publicKeySpkiBase64;
        });
        // Provide path resolution through IPC to avoid having to set
        // nodeIntegration to true.
        this.handle('mked:path:dirname', (_e, p) => (0, path_1.dirname)(p));
        this.handle('mked:path:resolve', (_e, base, rel) => (0, path_1.resolve)(base, rel));
        // Tab-free file read for the AI assistant. The agent's `read_file`
        // tool routes here when the requested file isn't already open as
        // a tab — opening every read in a new tab gets noisy fast when
        // the agent is gathering context across many files.
        //
        // **Trust boundary**: the renderer can supply any string here,
        // so we MUST scope to the current workspace before touching the
        // filesystem. `AppStorage.assertInWorkspace` resolves the path
        // (canonicalising symlinks) and throws if it lands outside the
        // open folder, or if no folder is open. See `AppStorage.ts` for
        // the rationale.
        this.handle('mked:fs:readfile', async (_e, path) => {
            const safePath = await AppStorage_1.AppStorage.assertInWorkspace(path);
            // Pre-flight stat so common confusions (directory passed
            // where a file was expected) surface as actionable errors
            // for the agent instead of raw EISDIR noise.
            const stat = await fs_1.promises.stat(safePath);
            if (stat.isDirectory()) {
                throw new Error(`${path} is a directory, not a file. Use list_files to enumerate its contents; use create_file to write a new file inside it.`);
            }
            const content = await fs_1.promises.readFile(safePath, 'utf-8');
            // Count line breaks rather than splitting (avoids a large
            // intermediate array for big files). Empty string → 1 line.
            let lineCount = 1;
            for (let i = 0; i < content.length; i++) {
                if (content.charCodeAt(i) === 0x0a)
                    lineCount += 1;
            }
            return { content, lineCount };
        });
        // Write a file with awaited success/failure — used by the AI
        // assistant's write-class tools (`write_file`, `edit_file`,
        // `replace_selection`, `insert_at_cursor`) so the agent gets
        // honest feedback instead of an unconditional ok. The existing
        // fire-and-forget `to:file:save` channel continues to serve the
        // menu-driven save flow.
        //
        // **Trust boundary**: `assertInWorkspace(path, {mustExist:false})`
        // resolves the parent (catching symlink escapes) and rejects
        // any target outside the workspace root.
        this.handle('mked:fs:savefile', async (_e, path, content) => {
            try {
                const safePath = await AppStorage_1.AppStorage.assertInWorkspace(path, {
                    mustExist: false,
                });
                await fs_1.promises.mkdir((0, path_1.dirname)(safePath), { recursive: true });
                await fs_1.promises.writeFile(safePath, content, 'utf-8');
                return { ok: true, path: safePath };
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { ok: false, error: message };
            }
        });
        // Create a new file with awaited success/failure — used by the
        // AI assistant's `create_file` tool. Validates that
        // `parent/name` lands inside the workspace, then delegates to
        // `AppStorage.createFile` (which mkdir -p's the parent, writes,
        // refreshes the tree, and opens the file as a tab); the
        // structured `{ok, error?}` result passes straight back to the
        // renderer so the tool can report honest status to the agent.
        this.handle('mked:fs:createfile', async (_e, parent, name, content) => {
            try {
                const target = (0, path_1.join)(parent, name);
                const safeTarget = await AppStorage_1.AppStorage.assertInWorkspace(target, {
                    mustExist: false,
                });
                return AppStorage_1.AppStorage.createFile(this.context, (0, path_1.dirname)(safeTarget), (0, path_1.basename)(safeTarget), content);
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { ok: false, error: message };
            }
        });
        // Create a new (empty) directory with awaited success/failure —
        // used by the AI assistant's `create_folder` tool so the agent
        // stops resorting to `.gitkeep` placeholders to make folders
        // visible. mkdir -p so intermediate directories are created on
        // demand. Same workspace-scope check as createfile.
        this.handle('mked:fs:createfolder', async (_e, parent, name) => {
            try {
                const target = (0, path_1.join)(parent, name);
                const safeTarget = await AppStorage_1.AppStorage.assertInWorkspace(target, {
                    mustExist: false,
                });
                return AppStorage_1.AppStorage.createFolder(this.context, (0, path_1.dirname)(safeTarget), (0, path_1.basename)(safeTarget));
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { ok: false, error: message };
            }
        });
        this.on('mked:open-url', (_e, url) => {
            try {
                this.handleMkedUrl(url);
            }
            catch (e) {
                this.providers.logger?.log.error('[mked:open-url]', e);
            }
        });
        // Broadcast language changes to the renderer
        this.on('to:i18n:set', (_e, lng) => {
            try {
                this.context.webContents.send('from:i18n:set', lng);
            }
            catch (e) {
                this.providers.logger?.log.error('[to:i18n:set]', e);
            }
        });
        // Renderer publishes the current workspace root whenever it
        // adopts a new one (BridgeListeners.from:folder:opened detects
        // the change). Main stores it as the trust boundary for all
        // `mked:fs:*` invokes — see `AppStorage.assertInWorkspace`.
        this.on('to:workspace:set', (_e, payload) => {
            AppStorage_1.AppStorage.setWorkspaceRoot(payload?.root ?? null);
        });
        // ---- AI Assistant ----------------------------------------------
        //
        // All `to:ai:*` channels delegate to the AppAssistant service the
        // composition root injects via `provide('assistant', ...)`. Each
        // handler returns silently when no AppAssistant is registered so
        // the bridge degrades gracefully in test contexts.
        this.on('to:ai:chat', (_e, payload) => {
            this.providers.assistant?.chat(payload);
        });
        this.on('to:ai:cancel', (_e, payload) => {
            this.providers.assistant?.cancel(payload);
        });
        this.on('to:ai:tool-result', (_e, payload) => {
            this.providers.assistant?.submitToolResult(payload);
        });
        this.on('to:ai:config:get', () => {
            this.pushAssistantConfig();
        });
        this.on('to:ai:config:set', (_e, payload) => {
            AssistantConfig_1.AssistantConfig.update(payload);
            this.pushAssistantConfig();
        });
        this.on('to:ai:key:set', (_e, payload) => {
            // Payload carries RSA-OAEP ciphertext (base64) — never the
            // raw API key. We decrypt with the per-session private key
            // held inside `SecureChannel`, hand the plaintext directly to
            // `AssistantKeyStore.setKey` (which re-encrypts via
            // safeStorage for disk), and let the plaintext fall out of
            // scope. The follow-up config push only carries
            // `hasKey: boolean` so the renderer never sees plaintext
            // come back either.
            let plaintext;
            try {
                plaintext = this.secureChannel.decryptString(payload.ciphertext);
            }
            catch (err) {
                // Malformed / tampered ciphertext: refuse to act on it and
                // leave the stored key untouched. Push the current config so
                // the renderer sees the unchanged state.
                this.providers.logger?.log.error('[to:ai:key:set] decrypt failed', err);
                this.pushAssistantConfig();
                return;
            }
            AssistantKeyStore_1.AssistantKeyStore.setKey(payload.provider, plaintext);
            this.pushAssistantConfig();
        });
        this.on('to:ai:key:clear', (_e, payload) => {
            AssistantKeyStore_1.AssistantKeyStore.clearKey(payload.provider);
            this.pushAssistantConfig();
        });
        this.on('to:ai:ollama:list', (_e, payload) => {
            void this.providers.assistant?.listOllamaModels(payload);
        });
        // Persisted conversation save. Renderer ships the latest
        // `AssistantManager.serialize()` output (debounced 500 ms on its
        // side); we drop it onto disk atomically. `null` payloads clear
        // the on-disk block.
        this.on('to:ai:conversations:save', (_e, payload) => {
            try {
                (0, assistantStoreFile_1.writePersistedConversations)(payload);
            }
            catch (e) {
                this.providers.logger?.log.error('[to:ai:conversations:save]', e);
            }
        });
        // Synchronous flush ack from the renderer in response to a
        // `from:ai:conversations:flush-request`. Main fires the request
        // before-quit so any in-flight debounce window doesn't lose the
        // last conversation mutation; the renderer answers synchronously
        // with the latest serialize() output.
        this.on('to:ai:conversations:flush', (_e, payload) => {
            try {
                (0, assistantStoreFile_1.writePersistedConversations)(payload);
            }
            catch (e) {
                this.providers.logger?.log.error('[to:ai:conversations:flush]', e);
            }
        });
        // Tear down every registered IPC listener and invoke handler when
        // this window closes.
        this.context.once('closed', () => this.dispose());
    }
    /**
     * Register an `ipcMain.on` handler scoped to this window's webContents.
     * The handler runs only when the event originated from our renderer.
     */
    on(channel, fn) {
        const handler = (event, ...args) => {
            if (event.sender.id !== this.context.webContents.id)
                return;
            void fn(event, ...args);
        };
        electron_1.ipcMain.on(channel, handler);
        this.listeners.push({
            channel,
            handler: handler,
        });
    }
    /**
     * Sender-scoped synchronous `ipcMain.on` handler. On a sender
     * mismatch we explicitly null the return value so a foreign
     * window never receives this window's per-session secrets.
     */
    onSync(channel, fn) {
        const handler = (event, ...args) => {
            if (event.sender.id !== this.context.webContents.id) {
                event.returnValue = null;
                return;
            }
            fn(event, ...args);
        };
        electron_1.ipcMain.on(channel, handler);
        this.listeners.push({
            channel,
            handler: handler,
        });
    }
    /**
     * Sender-scoped `ipcMain.handle` registration. Foreign senders get a
     * rejected invoke promise rather than a real result.
     */
    handle(channel, fn) {
        electron_1.ipcMain.handle(channel, (event, ...args) => {
            if (event.sender.id !== this.context.webContents.id) {
                throw new Error(`IPC ${channel}: sender mismatch`);
            }
            return fn(event, ...args);
        });
        this.invokeChannels.push(channel);
    }
    /**
     * Remove every IPC listener and invoke handler this bridge registered.
     */
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        for (const { channel, handler } of this.listeners) {
            electron_1.ipcMain.removeListener(channel, handler);
        }
        this.listeners = [];
        for (const channel of this.invokeChannels) {
            electron_1.ipcMain.removeHandler(channel);
        }
        this.invokeChannels = [];
    }
    /**
     * Push the sanitized assistant config to the renderer over
     * `from:ai:config`. Triggered by the `to:ai:config:get` handler, by
     * every config/key mutation, and by main.ts on `did-finish-load` so
     * the renderer hydrates on first paint.
     */
    pushAssistantConfig() {
        if (!this.providers.assistant)
            return;
        try {
            if (this.context.isDestroyed())
                return;
            this.context.webContents.send('from:ai:config', this.providers.assistant.buildSanitizedConfig());
        }
        catch (e) {
            this.providers.logger?.log.error('[from:ai:config]', e);
        }
    }
    /**
     * Push the persisted conversation block to the renderer over
     * `from:ai:conversations`. Called by main.ts on `did-finish-load`
     * (after `pushAssistantConfig`) so the sidebar hydrates with
     * history on first paint. Pre-P7 files surface as `null`.
     */
    pushPersistedConversations() {
        try {
            if (this.context.isDestroyed())
                return;
            this.context.webContents.send('from:ai:conversations', (0, assistantStoreFile_1.loadPersistedConversations)());
        }
        catch (e) {
            this.providers.logger?.log.error('[from:ai:conversations]', e);
        }
    }
    /**
     * Broadcast a flush request to the renderer over
     * `from:ai:conversations:flush-request`. Called by `main.ts`
     * `before-quit` so the renderer ships the latest debounce-buffered
     * serialize() output before the process exits.
     */
    requestPersistedConversationsFlush() {
        try {
            if (this.context.isDestroyed())
                return;
            this.context.webContents.send('from:ai:conversations:flush-request', null);
        }
        catch (e) {
            this.providers.logger?.log.error('[from:ai:conversations:flush-request]', e);
        }
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
