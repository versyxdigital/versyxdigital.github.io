"use strict";
/**
 * Menu model — single source of truth for the application menu.
 *
 * Consumed by:
 *   - `AppMenu` (same directory) — builds an Electron `Menu` from this
 *     model on macOS.
 *   - `<TitleBar>` (renderer, `src/browser/react/`) — renders a Radix
 *     `<DropdownMenu>` from the same model on Windows/Linux/web. The
 *     renderer reaches across via webpack at `../../app/lib/menuModel`;
 *     it lives here (rather than under `src/browser/`) because
 *     `src/app/tsconfig.json` excludes the browser tree, so the main
 *     process can't import from it.
 *
 * This file carries no Electron runtime imports so it stays consumable
 * from either side.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.menuModel = void 0;
exports.menuModel = [
    {
        id: 'file',
        label: 'File',
        items: [
            {
                id: 'file.new',
                label: 'New File...',
                accelerator: 'CmdOrCtrl+N',
                action: {
                    kind: 'channel',
                    channel: 'from:file:new',
                    payload: 'to:file:new',
                },
            },
            {
                id: 'file.open',
                label: 'Open File...',
                accelerator: 'CmdOrCtrl+O',
                action: {
                    kind: 'channel',
                    channel: 'from:file:open',
                    payload: 'to:file:open',
                },
            },
            {
                id: 'folder.open',
                label: 'Open Folder...',
                accelerator: 'CmdOrCtrl+Shift+O',
                action: {
                    kind: 'channel',
                    channel: 'from:folder:open',
                    payload: 'to:folder:open',
                },
            },
            {
                id: 'file.save',
                label: 'Save',
                accelerator: 'CmdOrCtrl+S',
                action: {
                    kind: 'channel',
                    channel: 'from:file:save',
                    payload: 'to:file:save',
                },
            },
            {
                id: 'file.saveas',
                label: 'Save As...',
                accelerator: 'CmdOrCtrl+Shift+S',
                action: {
                    kind: 'channel',
                    channel: 'from:file:saveas',
                    payload: 'to:file:saveas',
                },
            },
            {
                id: 'file.settings',
                label: 'Settings...',
                separatorBefore: true,
                action: {
                    kind: 'channel',
                    channel: 'from:modal:open',
                    payload: 'settings',
                },
            },
            {
                id: 'file.openlog',
                label: 'Open Log...',
                action: { kind: 'command', commandId: 'open-log' },
            },
            {
                id: 'file.quit',
                label: 'Quit',
                separatorBefore: true,
                action: { kind: 'role', role: 'quit' },
            },
        ],
    },
    {
        id: 'edit',
        label: 'Edit',
        items: [
            {
                id: 'edit.undo',
                label: 'Undo',
                action: { kind: 'role', role: 'undo' },
            },
            {
                id: 'edit.redo',
                label: 'Redo',
                action: { kind: 'role', role: 'redo' },
            },
            {
                id: 'edit.cut',
                label: 'Cut',
                separatorBefore: true,
                action: { kind: 'role', role: 'cut' },
            },
            {
                id: 'edit.copy',
                label: 'Copy',
                action: { kind: 'role', role: 'copy' },
            },
            {
                id: 'edit.paste',
                label: 'Paste',
                action: { kind: 'role', role: 'paste' },
            },
        ],
    },
    {
        id: 'view',
        label: 'View',
        items: [
            {
                id: 'view.palette',
                label: 'Open Command Palette',
                accelerator: 'F1',
                action: {
                    kind: 'channel',
                    channel: 'from:command:palette',
                    payload: 'open',
                },
            },
            {
                id: 'view.fullscreen',
                label: 'Toggle Full Screen',
                separatorBefore: true,
                action: { kind: 'role', role: 'togglefullscreen' },
            },
            {
                id: 'view.devtools',
                label: 'Toggle Developer Tools',
                accelerator: 'Ctrl+Shift+I',
                darwinAccelerator: 'Alt+Cmd+I',
                action: { kind: 'command', commandId: 'toggle-devtools' },
            },
        ],
    },
    {
        id: 'help',
        label: 'Help',
        items: [
            {
                id: 'help.about',
                label: 'About MKEditor',
                accelerator: 'CmdOrCtrl+/',
                action: {
                    kind: 'channel',
                    channel: 'from:modal:open',
                    payload: 'about',
                },
            },
            {
                id: 'help.shortcuts',
                label: 'Editor Shortcuts',
                accelerator: 'CmdOrCtrl+;',
                action: {
                    kind: 'channel',
                    channel: 'from:modal:open',
                    payload: 'shortcuts',
                },
            },
        ],
    },
];
