"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppMenu = void 0;
const electron_1 = require("electron");
const AppStorage_1 = require("./AppStorage");
const menuModel_1 = require("./menuModel");
/**
 * AppMenu
 *
 * Builds the Electron application menu from the shared `menuModel`.
 *
 * On macOS the menu lives on the system menu bar and stays in use; on
 * Windows and Linux we set `Menu.setApplicationMenu(null)` so the OS
 * strip disappears — the in-window `<TitleBar>` (added in P2) renders
 * the same model in the renderer.
 */
class AppMenu {
    /** The browser window */
    context;
    /** Providers to provide functions to the menu */
    providers = {
        bridge: null,
        logger: null,
    };
    /**
     * Create a new app menu handler to manage the app menu.
     *
     * @param context - the browser window
     * @param register - register all menu items immediately
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
     * Build the Electron menu template from `menuModel` and install it.
     *
     * On Windows + Linux we explicitly clear the application menu — the
     * in-window `<TitleBar>` (P2) is the new home for those entries.
     */
    register() {
        if (process.platform !== 'darwin') {
            electron_1.Menu.setApplicationMenu(null);
            return;
        }
        const template = menuModel_1.menuModel.map((group) => this.buildGroup(group));
        electron_1.app.applicationMenu = electron_1.Menu.buildFromTemplate(template);
    }
    buildGroup(group) {
        const submenu = [];
        for (const item of group.items) {
            if (item.separatorBefore) {
                submenu.push({ type: 'separator' });
            }
            submenu.push(this.buildItem(item));
        }
        return { label: group.label, submenu };
    }
    buildItem(item) {
        if (!item.action) {
            return { label: item.label, accelerator: this.resolveAccelerator(item) };
        }
        return this.applyAction(item, item.action);
    }
    /** macOS takes the `darwinAccelerator` override when present; everything
     *  else uses the default `accelerator`. Resolved here at runtime so the
     *  model itself stays platform-agnostic — webpack would otherwise bake
     *  the wrong platform into the renderer bundle. */
    resolveAccelerator(item) {
        if (process.platform === 'darwin' && item.darwinAccelerator) {
            return item.darwinAccelerator;
        }
        return item.accelerator;
    }
    applyAction(item, action) {
        const accelerator = this.resolveAccelerator(item);
        switch (action.kind) {
            case 'role':
                // Intentionally omit `label` — Electron picks the OS default
                // (e.g. "Exit" instead of "Quit" on Windows).
                return {
                    role: action.role,
                    accelerator,
                };
            case 'channel': {
                const { channel, payload } = action;
                return {
                    label: item.label,
                    accelerator,
                    click: () => this.context.webContents.send(channel, payload),
                };
            }
            case 'command':
                return {
                    label: item.label,
                    accelerator,
                    click: () => this.runCommand(action.commandId),
                };
        }
    }
    /**
     * Dispatch table for `{ kind: 'command' }` menu actions. Public so the
     * renderer-side in-window menu (P2) can reach the same handlers via
     * `to:command:run` — see `wireRendererCommandBridge()` below.
     *
     * Adding a new command means adding an entry here; both the native
     * macOS menu and the in-window menu pick it up for free.
     */
    runCommand(commandId) {
        switch (commandId) {
            case 'open-log': {
                const logpath = this.providers.logger?.logpath;
                if (logpath)
                    AppStorage_1.AppStorage.openPath(this.context, logpath);
                return;
            }
            case 'toggle-devtools':
                this.context.webContents.toggleDevTools();
                return;
            default:
                // Unknown commandId — drop silently rather than throw; the model
                // is the contract and an unknown id is a coding error caught in
                // dev, not a user-visible failure.
                return;
        }
    }
    /**
     * Register the `to:command:run` IPC listener so the renderer's
     * in-window menu (P2) can fire main-process commands through the
     * same dispatch table the native macOS menu uses. Called from
     * `main.ts` once per BrowserWindow.
     */
    wireRendererCommandBridge() {
        electron_1.ipcMain.on('to:command:run', (_event, commandId) => {
            this.runCommand(commandId);
        });
    }
    /**
     * Build the context menu for the system tray.
     *
     * @param context - the browser window
     * @returns
     */
    buildTrayContextMenu(context) {
        return electron_1.Menu.buildFromTemplate([
            {
                label: 'Show Window',
                click: () => {
                    electron_1.app.focus();
                    context.maximize();
                },
            },
            {
                label: 'Open Recent',
                role: 'recentDocuments',
                submenu: [
                    {
                        label: 'Clear Recent',
                        role: 'clearRecentDocuments',
                    },
                ],
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => electron_1.app.quit(),
            },
        ]);
    }
}
exports.AppMenu = AppMenu;
