"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppStorage = void 0;
const electron_1 = require("electron");
const fs_1 = require("fs");
const path_1 = require("path");
/**
 * AppStorage
 */
class AppStorage {
    /** The active file path */
    static activeFilePath = null;
    /**
     * The currently-open workspace root, or null when no folder is open.
     *
     * This is the **trust boundary** for the `mked:fs:*` IPC handlers
     * exposed via `window.mked` to the renderer. Without scoping, those
     * handlers would let a compromised renderer (XSS in a previewed
     * doc, malicious mked:// link, agent-gone-wrong, future plugin)
     * read or overwrite arbitrary user files. Every file-level invoke
     * resolves the requested path to canonical form (`fs.realpath` so
     * symlinks can't escape) and rejects anything that doesn't sit
     * inside this root. When the root is null, fs invokes are denied
     * outright — the user must open a folder first.
     *
     * Updated by the `to:workspace:set` IPC channel, which the renderer
     * fires from `BridgeListeners.from:folder:opened` only when the
     * tree adopts a new root (lazy sub-loads don't touch this).
     */
    static workspaceRoot = null;
    static getWorkspaceRoot() {
        return AppStorage.workspaceRoot;
    }
    /**
     * Set (or clear) the current workspace root. Main normalises with
     * `path.resolve` so trailing slashes / mixed separators are equivalent,
     * then canonicalises via `fs.realpathSync` so an opened symlinked folder
     * matches the canonical paths derived from `fs.realpath(target)`.
     *
     * `realpathSync` falls back to the lexical `resolve(root)` if the
     * directory can't be canonicalised (was just deleted, permission
     * denied, etc.), `assertInWorkspace` then surfaces the real error
     * the next time the user fs-ops against the workspace.
     */
    static setWorkspaceRoot(root) {
        if (!root) {
            AppStorage.workspaceRoot = null;
            return;
        }
        const absolute = (0, path_1.resolve)(root);
        try {
            AppStorage.workspaceRoot = (0, fs_1.realpathSync)(absolute);
        }
        catch {
            AppStorage.workspaceRoot = absolute;
        }
    }
    /**
     * Throw if `target` is outside the open workspace (or no workspace
     * is open). Returns the resolved (canonicalised, symlink-followed)
     * absolute path when the check passes — callers should fs-op on
     * the returned value, not the input, so symlink escapes can't
     * race a TOCTOU between this check and the fs call.
     *
     * Pass `mustExist: false` for write/create paths whose target may
     * not exist yet — the parent directory is canonicalised instead
     * and the (un-realpath'd) basename is rejoined. The parent itself
     * MUST exist for that mode; callers can `mkdir -p` separately.
     */
    static async assertInWorkspace(target, opts = { mustExist: true }) {
        const root = AppStorage.workspaceRoot;
        if (!root) {
            throw new Error('No workspace is open. Open a folder before reading or writing files.');
        }
        if (!target || typeof target !== 'string') {
            throw new Error('Invalid path');
        }
        let absolute = (0, path_1.resolve)(target);
        if (opts.mustExist === false) {
            // For write/create: canonicalise the PARENT (which must exist)
            // and rejoin the basename. We don't realpath the basename
            // because the file isn't there yet — a same-named symlink
            // racing into place between check and write is unlikely in
            // practice and main would need OS-level atomic ops to prevent.
            const parent = (0, path_1.dirname)(absolute);
            const base = (0, path_1.basename)(absolute);
            let canonicalParent;
            try {
                canonicalParent = await fs_1.promises.realpath(parent);
            }
            catch (err) {
                const code = err.code;
                if (code === 'ENOENT') {
                    // Parent doesn't exist yet — fall back to lexical
                    // resolution + scope check. mkdir -p in the caller will
                    // create it under the workspace root.
                    canonicalParent = parent;
                }
                else {
                    throw err;
                }
            }
            absolute = (0, path_1.join)(canonicalParent, base);
        }
        else {
            try {
                absolute = await fs_1.promises.realpath(absolute);
            }
            catch (err) {
                const code = err.code;
                if (code === 'ENOENT') {
                    throw new Error(`File not found: ${target}`, { cause: err });
                }
                throw err;
            }
        }
        const rel = (0, path_1.relative)(root, absolute);
        const isParentTraversal = rel === '..' || rel.startsWith('..' + path_1.sep);
        if (rel === '' || isParentTraversal || (0, path_1.isAbsolute)(rel)) {
            // Empty relative means target === root, which is fine for
            // directory ops but never for read/write of a file.
            if (rel === '' && opts.mustExist !== false) {
                throw new Error(`Path is a directory (workspace root), not a file: ${target}`);
            }
            if (isParentTraversal || (0, path_1.isAbsolute)(rel)) {
                throw new Error(`Path is outside the workspace: ${target} (workspace: ${root})`);
            }
        }
        return absolute;
    }
    /**
     * Get the path to the active file
     * @returns - the active file path or null
     */
    static getActiveFilePath() {
        return AppStorage.activeFilePath;
    }
    /**
     * Set the active file.
     *
     * @param context
     * @param file
     * @returns
     */
    static setActiveFile(context, file = null) {
        // Split on both separators so this works on Linux/macOS (`/`) and
        // Windows (`\`). The pre-existing version split only on `\` and
        // shipped the full path as `filename` on POSIX systems.
        const filename = file ? (file.split(/[\\/]/).pop() ?? '') : '';
        const content = file ? (0, fs_1.readFileSync)(file, { encoding: 'utf-8' }) : '';
        AppStorage.activeFilePath = file;
        if (file)
            electron_1.app.addRecentDocument(file);
        context.webContents.send('from:file:opened', {
            file,
            filename,
            content,
        });
        return {
            filename,
            content,
        };
    }
    /**
     * Open the active file.
     *
     * @param context - the browser window
     * @param file - the file to open
     * @returns
     */
    static openActiveFile(context, file) {
        if (context &&
            file &&
            file !== '.' &&
            !file.startsWith('-') &&
            file.indexOf('MKEditor.lnk') === -1) {
            AppStorage.setActiveFile(context, file);
        }
    }
    /**
     * Create a new file.
     *
     * @param context - the browser window
     */
    static async createNewFile(context) {
        AppStorage.setActiveFile(context, null);
    }
    /**
     * Save a file.
     *
     * @param context - the browser window
     * @param options - save file options
     * @returns
     */
    static async saveFile(context, options) {
        const config = {
            title: 'Save file',
            defaultPath: 'Untitled',
            buttonLabel: 'Save',
            filters: [
                { name: 'md', extensions: ['md'] },
                { name: 'All Files', extensions: ['*'] },
            ],
        };
        const isHTMLExport = options.data && options.data.startsWith('<!DOCTYPE html>');
        const errorAction = isHTMLExport
            ? 'notifications:unable_export_preview'
            : 'notifications:unable_save_markdown';
        const successAction = isHTMLExport
            ? 'notifications:exported_html_success'
            : 'notifications:saved_markdown_success';
        if (isHTMLExport) {
            config.filters.unshift({
                name: 'html',
                extensions: ['html'],
            });
            config.defaultPath = `export-0${options.id}`;
        }
        if (options.filePath) {
            let check;
            try {
                check = (0, fs_1.statSync)(options.filePath);
            }
            catch (err) {
                const details = err;
                check = details.code || err;
            }
            if (check !== 'ENOENT') {
                try {
                    (0, fs_1.writeFileSync)(options.filePath, options.data, {
                        encoding: options.encoding ?? 'utf-8',
                    });
                    context.webContents.send('from:notification:display', {
                        status: 'success',
                        key: successAction,
                    });
                    if (!isHTMLExport && options.openFile !== false) {
                        AppStorage.setActiveFile(context, options.filePath);
                    }
                }
                catch (err) {
                    context.webContents.send('from:notification:display', {
                        status: 'error',
                        key: errorAction,
                    });
                }
            }
            else {
                context.webContents.send('from:notification:display', {
                    status: 'error',
                    key: errorAction,
                });
            }
        }
        else {
            electron_1.dialog
                .showSaveDialog(context, config)
                .then(({ filePath }) => {
                try {
                    (0, fs_1.writeFileSync)(filePath, options.data, {
                        encoding: options.encoding ?? 'utf-8',
                    });
                    context.webContents.send('from:notification:display', {
                        status: 'success',
                        key: successAction,
                    });
                    if (!isHTMLExport && options.openFile !== false) {
                        AppStorage.setActiveFile(context, filePath);
                    }
                }
                catch (err) {
                    const details = err;
                    if (details.code !== 'ENOENT') {
                        context.webContents.send('from:notification:display', {
                            status: 'error',
                            key: 'notifications:generic_error_try_again',
                        });
                    }
                }
            })
                .catch(() => {
                context.webContents.send('from:notification:display', {
                    status: 'error',
                    key: 'notifications:generic_error_try_again',
                });
            });
        }
    }
    /**
     * Save a file to PDF.
     *
     * @param context - the browser window
     * @param offscreen - the offscreen render window for the PDF
     * @param options - save file options
     * @returns
     */
    static async saveFileToPDF(context, offscreen, options) {
        const defaultPath = `pdf-export-${options.id}`;
        offscreen.setTitle(defaultPath);
        await offscreen.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(options.data)}`);
        await offscreen.webContents.executeJavaScript(`
      (async () => {
        await document.fonts?.ready;
        const images = Array.from(document.images).map(img =>
          img.complete ? Promise.resolve() :
          new Promise(res => { img.onload = img.onerror = () => res(); })
        );
        await Promise.all(images);
      })();
    `);
        const pdf = await offscreen.webContents.printToPDF({
            pageSize: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
        });
        const { filePath } = await electron_1.dialog.showSaveDialog(context, {
            filters: [{ name: defaultPath, extensions: ['pdf'] }],
            defaultPath: `${defaultPath}.pdf`,
        });
        if (!filePath) {
            offscreen.destroy();
            return;
        }
        try {
            (0, fs_1.writeFileSync)(filePath, pdf, {
                encoding: options.encoding ?? 'utf-8',
            });
            context.webContents.send('from:notification:display', {
                status: 'success',
                key: 'notifications:exported_pdf_success',
            });
        }
        catch {
            context.webContents.send('from:notification:display', {
                status: 'error',
                key: 'notifications:unable_export_preview',
            });
        }
        finally {
            offscreen.destroy();
        }
    }
    /**
     * Show the open file dialog.
     *
     * @param context - the browser window
     * @returns
     */
    static async showOpenDialog(context) {
        return new Promise((resolve) => {
            electron_1.dialog
                .showOpenDialog({
                filters: [
                    { name: 'Text Files', extensions: ['html', 'md', 'txt'] },
                    { name: 'All Files', extensions: ['*'] },
                ],
                properties: ['openFile'],
            })
                .then(({ filePaths }) => {
                if (filePaths.length === 0) {
                    throw new Error('noselection');
                }
                const file = AppStorage.setActiveFile(context, filePaths[0]);
                return resolve({
                    file: filePaths[0],
                    filename: file.filename,
                    content: file.content,
                });
            })
                .catch((err) => {
                if (err.message !== 'noselection') {
                    context.webContents.send('from:notification:display', {
                        status: 'error',
                        key: 'notifications:unable_open_file',
                    });
                }
            });
        });
    }
    /**
     * Open a folder/directory path.
     *
     * @param context - the browser window
     * @param filePath - the filepath
     * @returns
     */
    static async openPath(context, filePath) {
        try {
            if (!filePath || typeof filePath !== 'string') {
                throw new Error('invalidpath');
            }
            const stats = await fs_1.promises.stat(filePath);
            if (stats.isDirectory()) {
                const tree = await AppStorage.readDirectory(filePath);
                context.webContents.send('from:folder:opened', {
                    path: filePath,
                    tree,
                });
            }
            else if (stats.isFile()) {
                AppStorage.setActiveFile(context, filePath);
            }
            else {
                throw new Error('unsupported');
            }
        }
        catch (err) {
            const code = err?.code || err.message;
            const key = code == 'EOENT' || code == 'invalidpath'
                ? 'notifications:path_not_exist'
                : code == 'EACCESS'
                    ? 'notifications:permission_denied_open_path'
                    : 'notifications:unable_open_path';
            context.webContents.send('from:notification:display', {
                status: 'error',
                key,
            });
        }
    }
    /**
     * Open a directory.
     *
     * @param context - the browser window
     * @returns
     */
    static async openDirectory(context) {
        try {
            const { filePaths } = await electron_1.dialog.showOpenDialog({
                properties: ['openDirectory'],
            });
            if (filePaths.length === 0) {
                throw new Error('noselection');
            }
            const tree = await AppStorage.readDirectory(filePaths[0]);
            context.webContents.send('from:folder:opened', {
                path: filePaths[0],
                tree,
            });
            return tree;
        }
        catch (err) {
            if (err.message !== 'noselection') {
                context.webContents.send('from:notification:display', {
                    status: 'error',
                    key: 'notifications:unable_open_folder',
                });
            }
        }
    }
    /**
     * Create a new empty file in the given directory.
     *
     * @param context - the browser window
     * @param parent - parent directory path
     * @param name - name of the new file
     */
    /**
     * Create a new file at `parent/name` with `content` and open it
     * as the active tab. Returns `{ok: true, path}` on success or
     * `{ok: false, error}` on failure so callers can react honestly —
     * the menu-driven flow surfaces a toast based on the result, and
     * the AI assistant's `create_file` tool reports the error back to
     * the agent instead of pretending the write succeeded. Parent
     * directories are auto-created.
     */
    static async createFile(context, parent, name, content = '') {
        try {
            const file = (0, path_1.join)(parent, name);
            // mkdir -p the parent so creating `poems/spring.md` succeeds
            // even when `poems/` doesn't exist yet — both the menu-driven
            // "new file" flow and the AI assistant's `create_file` tool
            // route through here. fs.mkdir with `recursive: true` is a
            // no-op when the directory already exists.
            await fs_1.promises.mkdir(parent, { recursive: true });
            await fs_1.promises.writeFile(file, content, 'utf-8');
            const tree = await AppStorage.readDirectory(parent);
            context.webContents.send('from:folder:opened', { path: parent, tree });
            // Open the newly-written file as a tab. Inlined here (instead of
            // a separate `to:file:openpath` round-trip from the renderer)
            // because the renderer-side `openPath` previously raced
            // `fs.writeFile` and surfaced a spurious "Unable to open path"
            // toast when stat ran before the write finished.
            AppStorage.setActiveFile(context, file);
            return { ok: true, path: file };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { ok: false, error: message };
        }
    }
    /**
     * Create a new folder in the given directory.
     */
    /**
     * Create a new folder at `parent/name`. Returns `{ok: true, path}`
     * on success or `{ok: false, error}` on failure so callers can
     * react honestly — the menu-driven flow surfaces a toast based on
     * the result, and the AI assistant's `create_folder` tool reports
     * the error back to the agent. `mkdir -p` so missing intermediate
     * directories are created automatically.
     */
    static async createFolder(context, parent, name) {
        try {
            const dir = (0, path_1.join)(parent, name);
            await fs_1.promises.mkdir(dir, { recursive: true });
            const tree = await AppStorage.readDirectory(parent);
            context.webContents.send('from:folder:opened', { path: parent, tree });
            return { ok: true, path: dir };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { ok: false, error: message };
        }
    }
    /**
     * Rename a file or folder.
     */
    static async renamePath(context, path, name) {
        const parent = (0, path_1.dirname)(path);
        try {
            const newPath = (0, path_1.join)(parent, name);
            await fs_1.promises.rename(path, newPath);
            const tree = await AppStorage.readDirectory(parent);
            context.webContents.send('from:folder:opened', { path: parent, tree });
            context.webContents.send('from:path:renamed', {
                oldPath: path,
                newPath,
                name,
            });
            context.webContents.send('from:notification:display', {
                status: 'success',
                key: 'notifications:renamed_success',
            });
        }
        catch {
            context.webContents.send('from:notification:display', {
                status: 'error',
                key: 'notifications:unable_rename',
            });
        }
    }
    /**
     * Delete a file or folder.
     */
    static async deletePath(context, path) {
        const parent = (0, path_1.dirname)(path);
        try {
            await fs_1.promises.rm(path, { recursive: true, force: true });
            const tree = await AppStorage.readDirectory(parent);
            context.webContents.send('from:folder:opened', { path: parent, tree });
            context.webContents.send('from:notification:display', {
                status: 'success',
                key: 'notifications:deleted_success',
            });
        }
        catch {
            context.webContents.send('from:notification:display', {
                status: 'error',
                key: 'notifications:unable_delete',
            });
        }
    }
    /**
     * Get properties of a file or folder.
     */
    static async getPathProperties(path) {
        const stats = await fs_1.promises.stat(path);
        let size;
        if (stats.size >= 1024 * 1024) {
            size = `${(stats.size / (1024 * 1024)).toFixed(2)} MB`;
        }
        else {
            size = `${(stats.size / 1024).toFixed(2)} KB`;
        }
        return {
            path,
            isDirectory: stats.isDirectory(),
            size,
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString(),
        };
    }
    /**
     * Read directory contents.
     *
     * @param dir - the directory to read
     * @returns - the directory contents
     */
    static async readDirectory(dir) {
        const entries = await fs_1.promises.readdir(dir, { withFileTypes: true });
        const filtered = entries.filter((d) => d.isDirectory() || d.name.endsWith('.md'));
        return Promise.all(filtered.map(async (entry) => {
            const full = (0, path_1.join)(dir, entry.name);
            if (entry.isDirectory()) {
                return {
                    type: 'directory',
                    name: entry.name,
                    path: full,
                    hasChildren: true,
                };
            }
            return { type: 'file', name: entry.name, path: full };
        }));
    }
}
exports.AppStorage = AppStorage;
