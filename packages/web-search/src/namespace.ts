/**
 * The settings identity both halves share, kept free of runtime imports.
 *
 * The Host half pairs this with a schemastery schema (settings.ts); the browser
 * half must NOT reach that file, because schemastery is absent from the shell's
 * frozen module table and would be inlined into the client bundle for a
 * constant.
 */

/**
 * Settings namespace. Equal to the package name so the settings document, the
 * served client bundle, and the plugin row all read as one thing — and so the
 * card's slot key needs no registry of its own.
 */
export const WEB_SEARCH_NAMESPACE = 'dsh-plugin-web-search'

/**
 * The user-tunable half of this plugin's configuration. Deliberately a SUBSET
 * of the plugin's cordis.yml `Config`: `timeoutMs` is fixed when the tool
 * registers (`defineTool` copies the value into the definition), so changing it
 * live would mean tearing the tool out of the registry and putting it back
 * mid-conversation. It stays a deployment knob in cordis.yml, which is also
 * where the harness's own web-search card draws the line.
 *
 * cordis.yml supplies these as the namespace's composition `base`, so a value
 * the user never touched still reads from the deployment's own configuration,
 * and clearing a field in the card returns it there rather than to the schema
 * default.
 */
export interface WebSearchSettings {
  /** Search API endpoint. */
  endpoint: string
  /** Credential reference holding the API key; the value itself never appears here. */
  apiKeyRef: string
  /** Result count used when the model omits `count`. */
  defaultCount: number
  /** Summary flag used when the model omits `summary`. */
  defaultSummary: boolean
}

/** Applied when neither a stored section nor a composition base supplies one. */
export const DEFAULT_SETTINGS: WebSearchSettings = {
  endpoint: 'https://api.bocha.cn/v1/web-search',
  apiKeyRef: 'BOCHA_API_KEY',
  defaultCount: 10,
  defaultSummary: true,
}

/** Accepted range for the result count, shared by the schema and the card's input. */
export const COUNT_RANGE = { min: 1, max: 50 } as const
