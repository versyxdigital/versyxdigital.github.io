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
 * On macOS the menu lives on the system menu bar and is visible there.
 * On Windows and Linux the in-window `<TitleBar>` (added in P2) renders
 * the same model — but we still install the Electron application menu
 * so global accelerators (Ctrl+S, Ctrl+O, etc.) keep working. The menu
 * bar itself is suppressed by the BrowserWindow being frameless plus
 * `autoHideMenuBar: true` / `setMenuBarVisibility(false)` in `main.ts`,
 * so the menu is functional-but-invisible and the user only ever sees
 * the renderer-drawn `<TitleBar>` strip.
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
     * Build the Electron menu template from `menuModel` and install it
     * on all platforms.
     *
     * On macOS this populates the system menu bar (the visible UI).
     * On Windows / Linux the menu bar is suppressed (frameless window +
     * `setMenuBarVisibility(false)` in `main.ts`), but the menu itself
     * is still registered so Electron's accelerator dispatcher fires
     * the click handlers when the user presses Ctrl+S / Ctrl+O / etc.
     * Without this the in-window `<TitleBar>` would show keybindings
     * that don't actually do anything.
     */
    register() {
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
     * renderer-side in-window TitleBar menu can reach the same handlers via
     * `to:command:run` — see `wireRendererCommandBridge()` below.
     *
     * Adding a new command means adding an entry here; both the native
     * macOS menu and the in-window menu pick it up for free.
     */
    runCommand(commandId) {
        // Bail if the window we'd dispatch onto has been destroyed (the
        // listener cleanup in `wireRendererCommandBridge` covers the
        // ordinary path, but late-firing events between `closed` and
        // `removeListener` can still arrive here).
        if (this.context.isDestroyed())
            return;
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
    /** Track the `to:command:run` handler so we can detach it on close. */
    commandBridgeHandler = null;
    /**
     * Register the `to:command:run` IPC listener so the renderer's
     * in-window TitleBar menu can fire main-process commands through the
     * same dispatch table the native macOS menu uses. Called from
     * `main.ts` once per BrowserWindow.
     *
     * The handler is sender-scoped (ignores IPC from any other
     * BrowserWindow's webContents) and torn down when this window
     * closes — both guards matter on macOS where the window can be
     * recreated via `app.on('activate')` and a stale handler would
     * otherwise dispatch commands onto the wrong / destroyed context.
     */
    wireRendererCommandBridge() {
        const handler = (event, commandId) => {
            if (event.sender.id !== this.context.webContents.id)
                return;
            this.runCommand(commandId);
        };
        electron_1.ipcMain.on('to:command:run', handler);
        this.commandBridgeHandler = handler;
        this.context.once('closed', () => {
            if (this.commandBridgeHandler) {
                electron_1.ipcMain.removeListener('to:command:run', this.commandBridgeHandler);
                this.commandBridgeHandler = null;
            }
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
                // Fires the same `from:assistant:toggle` channel the
                // application menu's View → Toggle Assistant Sidebar uses,
                // which routes through BridgeListeners → UIStateContext
                // `toggleRightSidebarExternal`.
                label: 'Toggle Assistant',
                click: () => {
                    if (!context.isDestroyed()) {
                        context.webContents.send('from:assistant:toggle');
                    }
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
