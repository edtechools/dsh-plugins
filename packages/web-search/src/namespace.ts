/**
 * The plugin's configuration type and settings identity, kept free of runtime
 * imports so both halves can take them.
 *
 * There is exactly ONE configuration type. `Config` is the cordis.yml schema
 * AND the settings namespace's schema: `installSettingsSection` registers the
 * namespace with the plugin's composition entry as the `base` layer, so the
 * resolution chain is schema default → cordis.yml → the user's settings
 * document, with no parallel type to keep in step.
 *
 * The schema itself lives in index.ts because it needs schemastery, which is
 * absent from the shell's frozen module table and would be inlined into the
 * client bundle for a constant. Types erase, so the browser half takes this
 * file and nothing else.
 */

/**
 * Settings namespace. Equal to the package name so the settings document, the
 * served client bundle, and the plugin row all read as one thing — and so the
 * card's slot key needs no registry of its own.
 */
export const WEB_SEARCH_NAMESPACE = 'dsh-plugin-web-search'

/** Everything this plugin can be configured with, from either layer. */
export interface WebSearchConfig {
  /** Search API endpoint. */
  endpoint: string
  /**
   * Credential reference naming this plugin's API key. The key itself is
   * never a settings field: it lives in the credential store, exactly as the
   * DeepSeek provider's does (`llm-deepseek` declares only `apiKeyEnv`).
   */
  apiKeyRef: string
  /** Result count used when the model omits `count`. */
  defaultCount: number
  /** Summary flag used when the model omits `summary`. */
  defaultSummary: boolean
  /** Cooperative timeout budget for one search. */
  timeoutMs: number
}

/** Applied when neither a stored section nor a composition base supplies one. */
export const DEFAULT_CONFIG: WebSearchConfig = {
  endpoint: 'https://api.bocha.cn/v1/web-search',
  apiKeyRef: 'BOCHA_API_KEY',
  defaultCount: 10,
  defaultSummary: true,
  timeoutMs: 30000,
}

/** Accepted ranges, shared by the schema and the card's inputs. */
export const RANGES = {
  defaultCount: { min: 1, max: 50 },
  timeoutMs: { min: 1000, max: 300000 },
} as const
