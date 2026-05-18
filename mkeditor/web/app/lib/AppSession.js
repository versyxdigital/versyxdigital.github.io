"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppSession = void 0;
const os_1 = require("os");
const fs_1 = require("fs");
const path_1 = require("path");
/**
 * AppSession
 *
 * Persists the renderer's open-tab / cursor / scroll session to
 * `~/.mkeditor/session.json` and reads it back at boot.
 *
 * The write is atomic: `session.json.tmp` is written first, then
 * `renameSync` swaps it into place. A power loss during the write
 * leaves either the prior canonical file intact or the new one, never
 * a truncated mix.
 *
 * Sibling to `AppSettings` but intentionally simpler — there's no
 * defaulting, no deep-merge, no notification side effects. The
 * renderer is the source of truth for shape; main only stewards
 * the JSON.
 */
class AppSession {
    /** Application config dir (shared with AppSettings). */
    static appPath = (0, path_1.normalize)((0, os_1.homedir)() + '/.mkeditor/');
    /** Canonical session file path. */
    static filePath = AppSession.appPath + 'session.json';
    /** Tmp path used by the atomic write. */
    static tmpPath = AppSession.filePath + '.tmp';
    /** Current schema version we know how to load. */
    static SCHEMA_VERSION = 1;
    /**
     * Read and validate the persisted session. Returns null if:
     *   - the file is absent
     *   - the JSON fails to parse
     *   - the parsed payload doesn't match `SessionPayload` shape
     *   - the schema version doesn't match `SCHEMA_VERSION`
     *
     * Never throws. Callers should treat null as "no prior session".
     */
    static load() {
        if (!(0, fs_1.existsSync)(AppSession.filePath))
            return null;
        let raw;
        try {
            raw = (0, fs_1.readFileSync)(AppSession.filePath, { encoding: 'utf-8' });
        }
        catch {
            return null;
        }
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            return null;
        }
        if (!AppSession.isValidPayload(parsed))
            return null;
        return parsed;
    }
    /**
     * Persist the session payload to disk atomically.
     *
     * Strategy: write to `session.json.tmp`, then `renameSync` into the
     * canonical path. POSIX rename is atomic; Windows NTFS rename is
     * atomic enough for our purposes (same volume).
     *
     * Synchronous so the `before-quit` flush can complete before the
     * process exits. Catches and swallows all errors — a failed session
     * write must never block app quit.
     */
    static save(payload) {
        try {
            if (!(0, fs_1.existsSync)(AppSession.appPath)) {
                (0, fs_1.mkdirSync)(AppSession.appPath, { recursive: true });
            }
            // Stamp the schema version on every write, even if the caller
            // supplied a different value — the canonical file is always at
            // the loader's known version.
            const serialised = JSON.stringify({ ...payload, version: AppSession.SCHEMA_VERSION }, null, 2);
            (0, fs_1.writeFileSync)(AppSession.tmpPath, serialised, { encoding: 'utf-8' });
            (0, fs_1.renameSync)(AppSession.tmpPath, AppSession.filePath);
        }
        catch {
            // Best-effort cleanup of a leftover tmp; ignore any failure.
            try {
                if ((0, fs_1.existsSync)(AppSession.tmpPath))
                    (0, fs_1.unlinkSync)(AppSession.tmpPath);
            }
            catch {
                // ignore
            }
        }
    }
    /**
     * Remove the persisted session file (and any leftover tmp from a
     * crashed write). Used by the renderer's "Clear saved session"
     * action. Never throws — a missing file is a successful no-op.
     */
    static clear() {
        try {
            if ((0, fs_1.existsSync)(AppSession.filePath))
                (0, fs_1.unlinkSync)(AppSession.filePath);
        }
        catch {
            // best-effort
        }
        try {
            if ((0, fs_1.existsSync)(AppSession.tmpPath))
                (0, fs_1.unlinkSync)(AppSession.tmpPath);
        }
        catch {
            // best-effort
        }
    }
    /**
     * Build a restore envelope ready to ship over IPC. Validates real-file
     * paths against the filesystem (untitled paths are left alone), drops
     * missing entries from `tabs`, lists them in `missing`, and reads
     * surviving file contents into `contents` so the renderer can hydrate
     * tabs synchronously. If the session's `activeFile` points at a
     * now-missing path, it's nulled out.
     *
     * Safe to call when `load()` returned null — produces an envelope
     * with `session: null`, empty missing/contents.
     */
    static buildRestoreEnvelope(payload) {
        if (!payload)
            return { session: null, missing: [], contents: {} };
        const missing = [];
        const kept = [];
        const contents = {};
        for (const tab of payload.tabs) {
            // Untitled tabs carry their content inline; nothing to check on disk.
            if (tab.path.startsWith('untitled-')) {
                kept.push(tab);
                continue;
            }
            if (!(0, fs_1.existsSync)(tab.path)) {
                missing.push(tab.path);
                continue;
            }
            try {
                contents[tab.path] = (0, fs_1.readFileSync)(tab.path, { encoding: 'utf-8' });
                kept.push(tab);
            }
            catch {
                // Treat unreadable files (permissions, race) as missing.
                missing.push(tab.path);
            }
        }
        const activeStillPresent = payload.activeFile !== null &&
            kept.some((t) => t.path === payload.activeFile);
        const keptRoot = payload.workspaceRoot && (0, fs_1.existsSync)(payload.workspaceRoot)
            ? payload.workspaceRoot
            : null;
        return {
            session: {
                version: payload.version,
                tabs: kept,
                activeFile: activeStillPresent ? payload.activeFile : null,
                workspaceRoot: keptRoot,
            },
            missing,
            contents,
        };
    }
    /**
     * Shape-check a parsed payload. Conservative: anything that doesn't
     * match exactly falls back to "no session". Better to start fresh
     * than to crash on a forward-incompatible file.
     */
    static isValidPayload(value) {
        if (typeof value !== 'object' || value === null)
            return false;
        const candidate = value;
        if (candidate.version !== AppSession.SCHEMA_VERSION)
            return false;
        if (!Array.isArray(candidate.tabs))
            return false;
        if (candidate.activeFile !== null &&
            typeof candidate.activeFile !== 'string') {
            return false;
        }
        // workspaceRoot was added after version 1 shipped. Accept missing
        // (treat as null) for back-compat; otherwise require null-or-string.
        if ('workspaceRoot' in candidate &&
            candidate.workspaceRoot !== null &&
            candidate.workspaceRoot !== undefined &&
            typeof candidate.workspaceRoot !== 'string') {
            return false;
        }
        for (const tab of candidate.tabs) {
            if (!AppSession.isValidTab(tab))
                return false;
        }
        return true;
    }
    static isValidTab(value) {
        if (typeof value !== 'object' || value === null)
            return false;
        const candidate = value;
        if (typeof candidate.path !== 'string')
            return false;
        if (typeof candidate.name !== 'string')
            return false;
        if ('untitledContent' in candidate &&
            typeof candidate.untitledContent !== 'string') {
            return false;
        }
        return true;
    }
}
exports.AppSession = AppSession;
