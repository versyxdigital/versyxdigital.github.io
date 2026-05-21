"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantKeyStore = void 0;
const electron_1 = require("electron");
const assistantStoreFile_1 = require("./assistantStoreFile");
/**
 * AssistantKeyStore
 *
 * Owns the encrypted API-key portion of `~/.mkeditor/assistant.json`.
 *
 * Keys for the API-key-bearing providers (Anthropic, OpenAI) are
 * encrypted with Electron's `safeStorage` (Keychain on macOS, DPAPI on
 * Windows, kwallet/gnome-keyring/basic-text on Linux) and base64-encoded
 * for JSON storage. A key value never leaves this module unless callers
 * invoke `getKey()` — and even then only inside the main process. The
 * `from:ai:*` channels only ever ship `hasKey: boolean` outward.
 *
 * Encryption availability is checked once per process and cached. On
 * platforms where `safeStorage.isEncryptionAvailable()` returns false
 * (notably some Linux configurations) we refuse to persist any new key
 * and `hasKey()` always returns false — the renderer disables remote
 * providers in that case.
 *
 * File I/O is delegated to `assistantStoreFile.ts` so this class and
 * `AssistantConfig` share a single read/write surface for the same
 * JSON blob.
 */
class AssistantKeyStore {
    /** Cached after first probe so we don't re-call safeStorage on every operation. */
    static encryptionAvailableCache = null;
    /**
     * Whether `safeStorage` can encrypt/decrypt on this platform. Cached
     * after the first call. The AppBridge pushes this flag into the
     * renderer's `from:ai:config` payload so the settings UI can show the
     * "encryption unavailable" warning when needed.
     */
    static isEncryptionAvailable() {
        if (AssistantKeyStore.encryptionAvailableCache === null) {
            try {
                AssistantKeyStore.encryptionAvailableCache =
                    electron_1.safeStorage.isEncryptionAvailable();
            }
            catch {
                AssistantKeyStore.encryptionAvailableCache = false;
            }
        }
        return AssistantKeyStore.encryptionAvailableCache;
    }
    /**
     * Decrypt and return the API key for an API-key-bearing provider, or
     * null if none is stored / encryption is unavailable / decryption
     * fails. Never throws. Callers (currently only `AppAssistant.chat`)
     * use the result to construct the SDK client and **must not** log it.
     */
    static getKey(provider) {
        if (!AssistantKeyStore.isEncryptionAvailable())
            return null;
        const store = (0, assistantStoreFile_1.loadAssistantStore)();
        const encoded = store.keys[provider];
        if (!encoded)
            return null;
        try {
            const buf = Buffer.from(encoded, 'base64');
            return electron_1.safeStorage.decryptString(buf);
        }
        catch {
            // Stored ciphertext is unreadable (corrupted on disk, OS keychain
            // rotated, different user, etc). Treat as no key.
            return null;
        }
    }
    /**
     * Cheap boolean check used by `from:ai:config` to surface whether a
     * provider is "connected" without exposing the key value. Does not
     * decrypt; just checks for the entry's presence in the file.
     */
    static hasKey(provider) {
        if (!AssistantKeyStore.isEncryptionAvailable())
            return false;
        const store = (0, assistantStoreFile_1.loadAssistantStore)();
        const value = store.keys[provider];
        return typeof value === 'string' && value.length > 0;
    }
    /**
     * Encrypt and persist a key for the given provider. Returns true on
     * success, false if encryption is unavailable or the write fails. The
     * AppBridge handler should respond with a fresh `from:ai:config` push
     * regardless so the renderer's UI reflects the actual on-disk state.
     */
    static setKey(provider, key) {
        if (!AssistantKeyStore.isEncryptionAvailable())
            return false;
        let encoded;
        try {
            encoded = electron_1.safeStorage.encryptString(key).toString('base64');
        }
        catch {
            return false;
        }
        const store = (0, assistantStoreFile_1.loadAssistantStore)();
        store.keys = { ...store.keys, [provider]: encoded };
        return (0, assistantStoreFile_1.writeAssistantStore)(store);
    }
    /**
     * Remove the stored key for the given provider. Returns true on
     * success (including the no-op case where no key was stored).
     */
    static clearKey(provider) {
        const store = (0, assistantStoreFile_1.loadAssistantStore)();
        if (!(provider in store.keys))
            return true;
        const nextKeys = { ...store.keys };
        delete nextKeys[provider];
        store.keys = nextKeys;
        return (0, assistantStoreFile_1.writeAssistantStore)(store);
    }
    /**
     * Hard-reset the encryption-availability cache. Test-only — the cache
     * is intentionally process-wide in production, and the renderer never
     * needs to clear it.
     */
    static _resetEncryptionCacheForTests() {
        AssistantKeyStore.encryptionAvailableCache = null;
    }
}
exports.AssistantKeyStore = AssistantKeyStore;
