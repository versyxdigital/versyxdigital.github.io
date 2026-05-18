"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppSettings = void 0;
const os_1 = require("os");
const fs_1 = require("fs");
const path_1 = require("path");
const electron_1 = require("electron");
const util_1 = require("../util");
/**
 * AppSettings
 */
class AppSettings {
    /** The browser window */
    context;
    /** Application settings dir path */
    appPath;
    /** Application settings file path */
    filePath;
    /** Has been newly created with defaults */
    isNewFile = false;
    /** Providers to provide functions to the settings */
    providers = {
        logger: null,
    };
    /** Default editor settings */
    settings = {
        autoindent: false,
        darkmode: false,
        wordwrap: true,
        whitespace: false,
        minimap: true,
        systemtheme: true,
        scrollsync: true,
        sessionRestore: true,
        locale: (0, util_1.normalizeLanguage)(electron_1.app.getLocale()),
        exportSettings: {
            withStyles: true,
            container: 'container-fluid',
            fontSize: 16,
            lineSpacing: 1.5,
            background: '#ffffff',
            fontColor: '#212529',
        },
    };
    /** Applied editor settings */
    applied = null;
    /**
     * Create a new app settings handler.
     *
     * @param context - the browser window
     * @returns
     */
    constructor(context) {
        this.context = context;
        this.appPath = (0, path_1.normalize)((0, os_1.homedir)() + '/.mkeditor/');
        this.filePath = this.appPath + 'settings.json';
        // Create the file if it doesn't exist, then load it.
        this.createFileIfNotExists(this.settings);
        const loaded = this.loadFile();
        // Check for settings file integrity
        if (!this.isNewFile && !(0, util_1.hasAllKeys)(this.settings, loaded)) {
            this.saveSettingsToFile((0, util_1.deepMerge)(this.settings, loaded));
        }
        // Set the applied settings for this session.
        this.applied = loaded;
    }
    /**
     * Get the editor settings.
     *
     * @returns - the editor settings
     */
    getSettings() {
        return this.applied;
    }
    /**
     * Get an editor setting.
     *
     * @param key - the setting key
     * @returns - the setting
     */
    getSetting(key) {
        return this.applied?.[key];
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
     * Load settings file.
     * @returns - the settings
     */
    loadFile() {
        try {
            const file = (0, fs_1.readFileSync)(this.filePath, {
                encoding: 'utf-8',
            });
            return JSON.parse(file);
        }
        catch (err) {
            this.context.webContents.send('from:notification:display', {
                status: 'error',
                key: 'notifications:settings_file_corrupted_reset',
            });
            return this.settings;
        }
    }
    /**
     * Create the settings file if it doesn't exist.
     *
     * @param settings - the settings to save
     * @returns
     */
    createFileIfNotExists(settings) {
        if (!(0, fs_1.existsSync)(this.appPath)) {
            (0, fs_1.mkdirSync)(this.appPath);
        }
        if (!(0, fs_1.existsSync)(this.filePath)) {
            const config = {
                ...this.settings,
                ...settings,
                exportSettings: {
                    ...this.settings.exportSettings,
                    ...(settings.exportSettings || {}),
                },
            };
            this.saveSettingsToFile(config, true);
            this.isNewFile = true;
        }
    }
    /**
     * Save current settings to the settings file.
     *
     * @param settings - the settings to save
     * @param init - first-time init
     * @returns
     */
    saveSettingsToFile(settings, init = false) {
        try {
            const base = (0, fs_1.existsSync)(this.filePath)
                ? this.loadFile()
                : this.settings;
            const updated = {
                ...base,
                ...settings,
                exportSettings: {
                    ...base.exportSettings,
                    ...(settings.exportSettings || {}),
                },
            };
            (0, fs_1.writeFileSync)(this.filePath, JSON.stringify(updated, null, 4), {
                encoding: 'utf-8',
            });
            this.applied = updated;
            if (!init) {
                this.context.webContents.send('from:notification:display', {
                    status: 'success',
                    key: 'notifications:settings_update_success',
                });
            }
        }
        catch (err) {
            const detail = err;
            const key = detail.code === 'EPERM'
                ? 'notifications:unable_save_settings_permission_denied'
                : 'notifications:unable_save_settings_unknown_error';
            this.providers.logger?.log.error(key, err);
            this.context.webContents.send('from:notification:display', {
                status: 'error',
                key,
            });
        }
    }
}
exports.AppSettings = AppSettings;
