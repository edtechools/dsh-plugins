/**
 * The Host-side schema for the user-tunable half of this plugin's
 * configuration. Kept apart from namespace.ts so the browser half can take the
 * identity and ranges without taking schemastery with it.
 */

import Schema from '@deepseek-ai/schemastery'
import { COUNT_RANGE, DEFAULT_SETTINGS, type WebSearchSettings } from './namespace.ts'

export const WebSearchSettingsSchema: Schema<WebSearchSettings> = Schema.object({
  endpoint: Schema.string().default(DEFAULT_SETTINGS.endpoint)
    .description('Search API endpoint.'),
  // Write-only by construction: `role('secret')` makes the settings seam strip
  // this field from `value`, `base`, and `user` in every response, and report
  // only whether a value stands through the descriptor's `secrets` list.
  apiKey: Schema.string().role('secret')
    .description('API key stored directly. Leave empty to resolve the credential reference below instead.'),
  apiKeyRef: Schema.string().role('credential-ref').default(DEFAULT_SETTINGS.apiKeyRef)
    .description('Credential reference used when no key is stored above; the value lives with the credential provider.'),
  defaultCount: Schema.number()
    .min(COUNT_RANGE.min).max(COUNT_RANGE.max)
    .default(DEFAULT_SETTINGS.defaultCount)
    .description('Result count used when the model omits `count`.'),
  defaultSummary: Schema.boolean().default(DEFAULT_SETTINGS.defaultSummary)
    .description('Summary flag used when the model omits `summary`.'),
})
