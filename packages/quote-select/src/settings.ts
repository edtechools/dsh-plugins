/**
 * The Host-side schema for this plugin's limits. Kept apart from namespace.ts
 * so the browser half can take the identity and ranges without taking
 * schemastery with it.
 */

import Schema from '@deepseek-ai/schemastery'
import { DEFAULT_SETTINGS, LIMITS, type QuoteSelectSettings } from './namespace.ts'

export const QuoteSelectSettingsSchema: Schema<QuoteSelectSettings> = Schema.object({
  maxQuoteLength: Schema.number()
    .min(LIMITS.maxQuoteLength.min).max(LIMITS.maxQuoteLength.max)
    .default(DEFAULT_SETTINGS.maxQuoteLength)
    .description('Longest quoted passage kept, in characters. A longer selection is cut with an ellipsis.'),
  maxCommentLength: Schema.number()
    .min(LIMITS.maxCommentLength.min).max(LIMITS.maxCommentLength.max)
    .default(DEFAULT_SETTINGS.maxCommentLength)
    .description('Longest comment kept, in characters.'),
  maxQuotes: Schema.number()
    .min(LIMITS.maxQuotes.min).max(LIMITS.maxQuotes.max)
    .default(DEFAULT_SETTINGS.maxQuotes)
    .description('Quotes one message may carry. Past this the selection pill refuses rather than dropping one silently.'),
})
