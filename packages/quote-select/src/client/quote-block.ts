/**
 * The draft encoding of collected quotes — and the whole of this plugin's state
 * model. Quotes live as a Markdown blockquote prefix inside the composer draft
 * rather than in plugin state beside it, because the harness gives a plugin one
 * public draft write path (`inputActions.setDraft`) and no hook on submission:
 * a parallel quote list would have nothing to fold itself into the outgoing
 * message with. Encoding in the draft buys sending, per-session isolation and
 * draft persistence for free, and makes the composer honest — what the user
 * reads there is exactly what the model receives.
 *
 * Round-trip stability is the load-bearing property: the quote strip re-composes
 * the entire prefix on every comment keystroke, so `compose(parse(draft))` must
 * return the draft unchanged. Nothing here trims or collapses an already-stored
 * value; capture-time normalization happens once, in {@link normalizeQuoteText}.
 * A comment of `"你好 "` therefore survives the space the user is still typing.
 */

/** Who wrote the quoted passage; `unknown` when the chat node kind names neither side. */
export type QuoteRole = 'user' | 'assistant' | 'unknown'

/** One collected quote: the passage, its optional comment, and its author. */
export interface Quote {
  readonly text: string
  readonly comment: string
  readonly role: QuoteRole
}

/** Draft split into the quote prefix and the message the user is writing. */
export interface ParsedDraft {
  readonly quotes: readonly Quote[]
  readonly body: string
}

/**
 * Role label as it appears in the draft. The parser accepts exactly these two
 * words, so widening the union means widening the pattern below with it.
 */
const ROLE_LABEL: Record<QuoteRole, string> = { user: '用户', assistant: '助手', unknown: '' }

const QUOTE_LINE = /^> 引用(\d+)(?:（(用户|助手)）)?：(.*)$/
const COMMENT_LINE = /^> 评论(\d+)：(.*)$/

/** Map a parsed role label back to its tag; an absent label is an untagged quote. */
function roleOfLabel(label: string | undefined): QuoteRole {
  if (label === '用户') return 'user'
  if (label === '助手') return 'assistant'
  return 'unknown'
}

/**
 * Flatten and cap one captured selection. Called once, at capture: the passage
 * occupies a single draft line, so its own line breaks must go, and an
 * over-long one is cut with an ellipsis that says so to reader and model alike.
 * @param raw - the selection as the browser reported it.
 * @param max - longest passage kept, from the plugin's settings section.
 * @returns the single-line passage stored in the draft.
 */
export function normalizeQuoteText(raw: string, max: number): string {
  const flat = raw.replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, max)}…`
}

/**
 * Make one comment storable without disturbing what the user typed: line breaks
 * would end the comment's line and are folded to spaces, length is capped, and
 * surrounding spaces are deliberately left alone so a comment being edited in
 * the strip round-trips through the draft character for character.
 * @param raw - the comment as typed.
 * @param max - longest comment kept, from the plugin's settings section.
 * @returns the comment as stored on its draft line.
 */
export function sanitizeComment(raw: string, max: number): string {
  const flat = raw.replace(/[\r\n]+/g, ' ')
  return flat.length <= max ? flat : flat.slice(0, max)
}

/**
 * Render quotes and message back into one draft. Numbering is assigned here, so
 * a removal renumbers what remains and the draft never shows a gap.
 * @param quotes - the quotes, in strip order.
 * @param body - the message the user is writing, without the prefix.
 * @returns the full draft text.
 */
export function composeDraft(quotes: readonly Quote[], body: string): string {
  if (quotes.length === 0) return body
  const lines: string[] = []
  quotes.forEach((quote, index) => {
    const number = index + 1
    const label = ROLE_LABEL[quote.role]
    lines.push(`> 引用${number}${label === '' ? '' : `（${label}）`}：${quote.text}`)
    // An empty comment emits no line, and parsing yields '' for it — the two
    // sides of the same round trip. A whitespace-only comment DOES emit, so
    // that the spaces do not vanish under the caret of whoever is typing them.
    if (quote.comment !== '') lines.push(`> 评论${number}：${quote.comment}`)
  })
  return `${lines.join('\n')}\n\n${body}`
}

/**
 * Recover quotes and message from a draft. Only a leading run of quote/comment
 * lines counts, so the same syntax further down the message is the user's own
 * Markdown and is left in the body untouched.
 * @param draft - the current composer draft.
 * @returns the quotes and the remaining message; no leading run yields no quotes and the draft verbatim.
 */
export function parseDraft(draft: string): ParsedDraft {
  const lines = draft.split('\n')
  const byNumber = new Map<number, Quote>()
  let cursor = 0
  for (; cursor < lines.length; cursor += 1) {
    const line = lines[cursor] ?? ''
    const quoted = QUOTE_LINE.exec(line)
    if (quoted !== null) {
      const number = Number(quoted[1])
      byNumber.set(number, {
        text: quoted[3] ?? '',
        comment: byNumber.get(number)?.comment ?? '',
        role: roleOfLabel(quoted[2]),
      })
      continue
    }
    const commented = COMMENT_LINE.exec(line)
    if (commented !== null) {
      const number = Number(commented[1])
      const existing = byNumber.get(number)
      byNumber.set(number, {
        text: existing?.text ?? '',
        comment: commented[2] ?? '',
        role: existing?.role ?? 'unknown',
      })
      continue
    }
    break
  }

  // A comment line with no quote line of its own addresses nothing; dropping it
  // here is also what removes it from the draft, at the next re-compose.
  const quotes = [...byNumber.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, quote]) => quote)
    .filter(quote => quote.text !== '')
  if (quotes.length === 0) return { quotes: [], body: draft }
  return { quotes, body: (lines.slice(cursor).join('\n')).replace(/^\n+/, '') }
}
