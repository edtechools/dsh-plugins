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
  apiKeyRef: Schema.string().default(DEFAULT_SETTINGS.apiKeyRef)
    .description('Credential reference holding the API key; the value never appears in configuration.'),
  defaultCount: Schema.number()
    .min(COUNT_RANGE.min).max(COUNT_RANGE.max)
    .default(DEFAULT_SETTINGS.defaultCount)
    .description('Result count used when the model omits `count`.'),
  defaultSummary: Schema.boolean().default(DEFAULT_SETTINGS.defaultSummary)
    .description('Summary flag used when the model omits `summary`.'),
})
