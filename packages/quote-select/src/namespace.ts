/**
 * The settings identity both halves share, kept free of runtime imports.
 *
 * The Host half pairs this with a schemastery schema (settings.ts); the browser
 * half must NOT reach that file, because schemastery is absent from the shell's
 * frozen module table and would therefore be inlined into the client bundle for
 * a constant. Splitting the identity out is what keeps the browser bundle to
 * the values it actually needs.
 */

/**
 * Settings namespace. Equal to the package name so the settings document, the
 * served client bundle, and the plugin row all read as one thing — and so the
 * card's slot key needs no registry of its own.
 */
export const QUOTE_SELECT_NAMESPACE = 'dsh-plugin-quote-select'

/**
 * The bounds this plugin enforces on what a message may carry. All three are
 * durable preferences rather than constants: how much quoted text belongs in
 * one message is a judgement about the deployment's model and context budget,
 * not a property of the quoting mechanism.
 */
export interface QuoteSelectConfig {
  /** Longest passage kept; a longer selection is cut with an ellipsis. */
  maxQuoteLength: number
  /** Longest comment kept; also the inputs' `maxLength`. */
  maxCommentLength: number
  /** Quotes one message may carry. Past this the pill refuses rather than truncating silently. */
  maxQuotes: number
}

/** Applied when no settings provider is composed, matching the schema defaults. */
export const DEFAULT_CONFIG: QuoteSelectConfig = {
  maxQuoteLength: 600,
  maxCommentLength: 200,
  maxQuotes: 8,
}

/**
 * Accepted ranges, shared by the schema and the card's number inputs so the
 * control cannot offer a value the Host would reject.
 */
export const LIMITS = {
  maxQuoteLength: { min: 50, max: 4000 },
  maxCommentLength: { min: 20, max: 1000 },
  maxQuotes: { min: 1, max: 32 },
} as const
