/**
 * The four things this plugin needs from the shell's DOM, kept together so the
 * coupling is countable. Every selector here is a `data-` attribute the harness
 * renders deliberately (`ChatNodeSeat`, `InputBar`), not a hashed class name —
 * those are rebuilt per build and cannot be targeted from an out-of-tree plugin.
 */

import type { QuoteRole } from './quote-block.ts'

/** Highlight registry name; also the `::highlight()` selector in this plugin's stylesheet. */
const HIGHLIGHT_NAME = 'dsh-quote-select'

/** Chat node kinds whose text is the assistant speaking. */
const ASSISTANT_KINDS = new Set(['assistant-step', 'turn-tail'])

/** One quotable passage: where the selection landed and who wrote it. */
export interface QuoteSource {
  readonly role: QuoteRole
}

/**
 * Resolve the chat node a selection endpoint sits in. Selections outside the
 * conversation flow — the composer, the sidebar, a tool panel — resolve to
 * null, which is what keeps the pill off everything that is not a message.
 * @param node - a selection endpoint, typically `Selection.anchorNode`.
 * @returns the passage's author, or null when the endpoint is not in a chat node.
 */
export function resolveQuoteSource(node: Node | null): QuoteSource | null {
  const element = node instanceof HTMLElement ? node : node?.parentElement ?? null
  const seat = element?.closest<HTMLElement>('[data-chat-flow-kind]') ?? null
  if (seat === null) return null
  const kind = seat.getAttribute('data-chat-flow-kind')
  if (kind === 'user') return { role: 'user' }
  // The kind set is open (chat nodes merge their own kinds in), so an
  // unrecognized one is quoted without an author tag rather than mislabelled.
  return { role: kind !== null && ASSISTANT_KINDS.has(kind) ? 'assistant' : 'unknown' }
}

/**
 * Hand the composer back the focus a quote action took, with the caret at the
 * end — where the message body now continues. Deferred one frame because the
 * draft write that precedes it has not reached the textarea yet: React commits
 * on the microtask queue, which a rAF callback runs after.
 */
export function focusComposerAtEnd(): void {
  requestAnimationFrame(() => {
    const textarea = document.querySelector<HTMLTextAreaElement>('[data-input-scroll] textarea')
    if (textarea === null || textarea.disabled) return
    textarea.focus({ preventScroll: true })
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  })
}

/**
 * Paint the quoted passages in place through the CSS Custom Highlight API. The
 * ranges are live, so they follow reflow and scrolling for free and collapse on
 * their own when the message that holds them re-renders — a collapsed one
 * simply stops painting, which is the right answer for a passage whose DOM is
 * gone. Absent API support (older engines) turns the highlight off and leaves
 * every other surface working.
 * @param ranges - the live ranges of the currently collected quotes.
 */
export function paintQuoteHighlight(ranges: readonly Range[]): void {
  const registry = CSS.highlights
  if (registry === undefined || typeof Highlight === 'undefined') return
  const live = ranges.filter(range => range.startContainer.isConnected && range.endContainer.isConnected)
  if (live.length === 0) {
    registry.delete(HIGHLIGHT_NAME)
    return
  }
  registry.set(HIGHLIGHT_NAME, new Highlight(...live))
}

/** Where one quote's badge sits, in viewport coordinates. */
export interface BadgePlacement {
  /** Quote index; the badge shows `index + 1`, matching the strip's numbering. */
  readonly index: number
  readonly top: number
  readonly left: number
}

/** Viewport margin a badge is kept inside, so one against the right edge stays whole. */
const BADGE_MARGIN = 6
/**
 * Horizontal room one badge needs. Used only to separate two badges that land
 * on the same line — a rendered badge is narrower than this for single digits,
 * so the gap is generous rather than exact, which is the right error to make
 * for a marker that must never sit on top of another one.
 */
const BADGE_CLEARANCE = 20
/** Vertical distance under which two badges count as sharing a line. */
const SAME_LINE_EPSILON = 4

/**
 * The band of viewport where transcript text is actually visible.
 *
 * The composer is sticky INSIDE the conversation scrollport, so the
 * scrollport's own bottom edge sits behind it and cannot be the limit. The
 * seat is found by walking up from the textarea to the first sticky ancestor
 * rather than by class name, because the harness hashes its class names per
 * build; the walk is stable across dock rows appearing and disappearing above
 * the composer card.
 * @returns the visible band, or null when no conversation is mounted.
 */
function transcriptBand(): { top: number; bottom: number } | null {
  const scrollport = document.querySelector('[data-conversation-scroll]')
  if (scrollport === null) return null
  const rect = scrollport.getBoundingClientRect()
  let bottom = rect.bottom
  let node = document.querySelector('[data-input-scroll]')?.parentElement ?? null
  while (node !== null && node !== scrollport) {
    if (getComputedStyle(node).position === 'sticky') {
      bottom = Math.min(bottom, node.getBoundingClientRect().top)
      break
    }
    node = node.parentElement
  }
  return { top: rect.top, bottom }
}

/**
 * Place a badge at the trailing edge of each live quote. The LAST client rect
 * is the anchor, not the first: a passage spanning several lines ends on the
 * last one, and that is where a marker reads as "this passage, up to here".
 *
 * `top` is the line box's TOP, not its middle: a quote that ends mid-sentence
 * would otherwise seat the badge between two words at reading height and cut
 * the sentence in half. Riding the top edge puts it in the leading, the way a
 * footnote marker does, where it interrupts nothing.
 *
 * A range whose message has re-rendered has collapsed and yields no rects — it
 * drops out here exactly as it drops out of the highlight. Ranges outside the
 * visible transcript band drop out too: the badge layer is portalled to
 * document.body, so it is outside the conversation's stacking context and no
 * z-index can seat it under the composer — not painting what has scrolled
 * behind the composer is the only thing that works.
 * @param ranges - the live ranges of the currently collected quotes.
 * @returns one placement per visible quote, in quote order.
 */
export function placeQuoteBadges(ranges: readonly Range[]): BadgePlacement[] {
  const band = transcriptBand()
  if (band === null) return []
  const placements: BadgePlacement[] = []
  ranges.forEach((range, index) => {
    const rects = range.getClientRects()
    const rect = rects[rects.length - 1]
    if (rect === undefined || (rect.width === 0 && rect.height === 0)) return
    // The badge rides the line's top edge, so the TOP is what must clear the
    // composer; a line half-hidden behind it takes its badge down with it.
    if (rect.top < band.top || rect.top > band.bottom) return
    let left = Math.min(rect.right, window.innerWidth - BADGE_MARGIN)
    // Two quotes can end on the same line — quoting twice in one sentence is
    // ordinary. Ranges are walked in quote order, so it is enough to compare
    // with the one placed immediately before.
    const previous = placements[placements.length - 1]
    if (
      previous !== undefined
      && Math.abs(previous.top - rect.top) < SAME_LINE_EPSILON
      && left - previous.left < BADGE_CLEARANCE
    ) {
      left = previous.left + BADGE_CLEARANCE
    }
    placements.push({ index, top: rect.top, left })
  })
  return placements
}
