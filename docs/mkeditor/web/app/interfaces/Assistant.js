"use strict";
/**
 * AI Assistant — shared types for the main process and the wire payloads
 * exchanged with the renderer.
 *
 * No imports from the SDK or from electron — these types are referenced
 * by both `src/app/lib/AppAssistant.ts` (which owns the SDK clients) and,
 * indirectly via the `from:ai:*` event payloads, by the renderer's
 * `AssistantManager` (P4+). The renderer cannot import from `src/app/`,
 * so the same shapes are duplicated on the renderer side in P2/P4 when
 * they're needed there.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PROVIDER_CONFIG = void 0;
/** Defaults applied when no config file exists. User overrides in P3. */
exports.DEFAULT_PROVIDER_CONFIG = {
    anthropic: {
        enabled: false,
        defaultModel: 'claude-sonnet-4-6',
    },
    openai: {
        enabled: false,
        defaultModel: 'gpt-5',
    },
    ollama: {
        enabled: false,
        baseUrl: 'http://localhost:11434',
        defaultModel: 'llama3.2',
    },
};
