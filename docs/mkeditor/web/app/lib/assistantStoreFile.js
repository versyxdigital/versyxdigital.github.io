"use strict";
/**
 * Internal helper module for `~/.mkeditor/assistant.json` I/O.
 *
 * Both `AssistantKeyStore` and `AssistantConfig` need to read and write
 * the same file (different sections of the same JSON blob). They both
 * read the whole file, modify their section, and write the whole file
 * back atomically. Putting the I/O here keeps the two classes peers
 * rather than one depending on the other.
 *
 * Not exported from `lib/index` (no such barrel exists) — only the two
 * sibling classes import from here.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.assistantStoreDir = exports.assistantStoreTmpPath = exports.assistantStorePath = exports.ASSISTANT_STORE_VERSION = void 0;
exports.loadAssistantStore = loadAssistantStore;
exports.writeAssistantStore = writeAssistantStore;
exports.loadPersistedConversations = loadPersistedConversations;
exports.writePersistedConversations = writePersistedConversations;
const os_1 = require("os");
const fs_1 = require("fs");
const path_1 = require("path");
const Assistant_1 = require("../interfaces/Assistant");
exports.ASSISTANT_STORE_VERSION = 1;
const APP_PATH = (0, path_1.normalize)((0, os_1.homedir)() + '/.mkeditor/');
const FILE_PATH = APP_PATH + 'assistant.json';
const TMP_PATH = FILE_PATH + '.tmp';
const assistantStorePath = () => FILE_PATH;
exports.assistantStorePath = assistantStorePath;
const assistantStoreTmpPath = () => TMP_PATH;
exports.assistantStoreTmpPath = assistantStoreTmpPath;
const assistantStoreDir = () => APP_PATH;
exports.assistantStoreDir = assistantStoreDir;
const fallback = () => ({
    version: exports.ASSISTANT_STORE_VERSION,
    providers: Assistant_1.DEFAULT_PROVIDER_CONFIG,
    keys: {},
});
/**
 * Load the on-disk store, or return a defaulted shape if the file is
 * missing / corrupt / schema-mismatched. Never throws.
 */
function loadAssistantStore() {
    if (!(0, fs_1.existsSync)(FILE_PATH))
        return fallback();
    let raw;
    try {
        raw = (0, fs_1.readFileSync)(FILE_PATH, { encoding: 'utf-8' });
    }
    catch {
        return fallback();
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return fallback();
    }
    if (!isValidStore(parsed))
        return fallback();
    return parsed;
}
/**
 * Atomic write of the whole store (tmp + rename — same pattern as
 * `AppSession.save`). Returns true on success, false on any IO failure.
 * Never throws. Best-effort cleanup of a leftover tmp on failure.
 *
 * Stamps the current schema version on every write regardless of caller
 * input, so the canonical file on disk always matches the loader's
 * expected version.
 */
function writeAssistantStore(store) {
    try {
        if (!(0, fs_1.existsSync)(APP_PATH)) {
            (0, fs_1.mkdirSync)(APP_PATH, { recursive: true });
        }
        const serialised = JSON.stringify({ ...store, version: exports.ASSISTANT_STORE_VERSION }, null, 2);
        (0, fs_1.writeFileSync)(TMP_PATH, serialised, { encoding: 'utf-8' });
        (0, fs_1.renameSync)(TMP_PATH, FILE_PATH);
        return true;
    }
    catch {
        try {
            if ((0, fs_1.existsSync)(TMP_PATH))
                (0, fs_1.unlinkSync)(TMP_PATH);
        }
        catch {
            // best-effort
        }
        return false;
    }
}
/**
 * Read the persisted conversation block from the store file.
 * Returns null when the file is fresh, predates the conversations
 * block, or is malformed. Never throws.
 *
 * Files written before the conversations block existed (just
 * `version` + `providers` + `keys`) come back from
 * `loadAssistantStore` with `conversations: undefined`, which this
 * helper surfaces as `null` so the caller can short-circuit the
 * restore.
 */
function loadPersistedConversations() {
    const store = loadAssistantStore();
    return store.conversations ?? null;
}
/**
 * Write the persisted conversation block to the store file.
 * Reads the current file (so `providers` / `keys` are preserved),
 * replaces `conversations`, writes atomically. Passing `null`
 * removes the block (used by tests / a future "clear history"
 * affordance — `serialize()` itself never produces null after the
 * first conversation is created).
 */
function writePersistedConversations(conversations) {
    const store = loadAssistantStore();
    if (conversations === null) {
        delete store.conversations;
    }
    else {
        store.conversations = conversations;
    }
    return writeAssistantStore(store);
}
/**
 * Shape-check a parsed payload. Conservative: anything that doesn't
 * match falls back to defaults rather than throwing.
 */
function isValidStore(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const candidate = value;
    if (candidate.version !== exports.ASSISTANT_STORE_VERSION)
        return false;
    if (typeof candidate.providers !== 'object' || candidate.providers === null) {
        return false;
    }
    if (typeof candidate.keys !== 'object' || candidate.keys === null) {
        return false;
    }
    for (const provider of ['anthropic', 'openai', 'ollama']) {
        if (!(provider in candidate.providers))
            return false;
    }
    return true;
}
