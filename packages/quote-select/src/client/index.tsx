/**
 * Quote-selection plugin, browser half: select text in any chat message and a
 * pill floats over the selection offering 「引用」 (quote it into the composer)
 * and 「评论」 (attach a note first). Collected quotes stay marked in the
 * transcript and are listed in a strip above the input, where their comments
 * stay editable until the message is sent.
 *
 * One seat, three surfaces. Everything registers into `conversation.input.dock`
 * — the only slot that carries both the live draft and `inputActions`, which
 * this plugin needs because quotes are stored IN the draft (see
 * quote-block.ts). The pill and the transcript highlight are not dock content;
 * they are portalled to `document.body` and painted through the Highlight API
 * from that same component, so all three surfaces read one state and the seat
 * contributes no layout of its own while the strip is empty.
 *
 * Session scope comes for free with the seat: each session parses its own
 * draft, so quotes never leak across a session switch, and they persist exactly
 * as the draft does.
 */

import * as React from 'react'
import { createPortal } from 'react-dom'
// Platform modules, so these stay externals the shell's frozen table answers —
// the icons are the product's own, drawn on its grid, not a second copy.
import {
  IconCheckOutline14, IconChevronDownOutline14, IconCloseOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import {
  composeDraft, normalizeQuoteText, parseDraft, sanitizeComment,
  type Quote, type QuoteRole,
} from './quote-block.ts'
// Identity and ranges only — never `../settings.ts`, which would drag
// schemastery into this bundle (see namespace.ts).
import { QUOTE_SELECT_NAMESPACE, type QuoteSelectSettings } from '../namespace.ts'
import { createSettingsStore } from './settings-store.ts'
import { SettingsCard } from './SettingsCard.tsx'
import {
  focusComposerAtEnd, paintQuoteHighlight, placeQuoteBadges, resolveQuoteSource,
  type BadgePlacement,
} from './chat-dom.ts'
import { CSS } from './styles.ts'

export const inject = ['slots']

/** Dock order: below the plan strip (0), the queue (20) and the goal bar. */
const SLOT_ORDER = 30
/** Gap between the selection rect and the pill, and the margin the pill keeps inside the viewport. */
const PILL_GAP = 8
const VIEWPORT_MARGIN = 12

/** Human label for a quote's author; untagged quotes render no label at all. */
const ROLE_TEXT: Record<QuoteRole, string> = { user: '用户', assistant: '助手', unknown: '' }

/** A selection waiting for the user to decide what to do with it. */
interface PendingSelection {
  readonly text: string
  readonly role: QuoteRole
  /** Live range, kept so an accepted quote can stay highlighted where it was read. */
  readonly range: Range
  /** Selection rect at capture time; the pill is placed against it and dismissed if the viewport moves. */
  readonly anchor: DOMRect
}

/** Quotation glyph. Hand-drawn: the product icon set has no quote mark. */
function QuoteGlyph({ size = 14 }: { size?: number }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M2.6 4h4.2v3.9c0 2.3-1.4 3.8-3.5 4.1v-1.7c1-.2 1.6-.9 1.7-1.8H2.6V4Zm6.6 0h4.2v3.9c0 2.3-1.4 3.8-3.5 4.1v-1.7c1-.2 1.6-.9 1.7-1.8H9.2V4Z" />
    </svg>
  )
}

/** Comment glyph: a speech bubble with a plus. Hand-drawn for the same reason. */
function CommentGlyph({ size = 14 }: { size?: number }): React.ReactElement {
  return (
    <svg
      width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="M13.6 3.1H2.4v6.8h2.3v2.4l2.9-2.4h6Z" />
      <path d="M8 5.1v2.8M6.6 6.5h2.8" />
    </svg>
  )
}

/** Keep a coordinate inside the viewport with a margin on both sides. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

interface SelectionPillProps {
  readonly pending: PendingSelection
  /** True once the quote budget is spent: both actions refuse rather than truncate the list. */
  readonly full: boolean
  /** Live limits from the plugin's settings section. */
  readonly limits: QuoteSelectSettings
  readonly commenting: boolean
  readonly onStartComment: () => void
  readonly onCommit: (comment: string) => void
  readonly onDismiss: () => void
}

/**
 * The floating pill. It positions itself after measuring, because its width is
 * whatever its labels come to and it doubles in size when it becomes a comment
 * field — a pre-computed position would be wrong in both states.
 */
function SelectionPill(props: SelectionPillProps): React.ReactElement {
  const pillRef = React.useRef<HTMLDivElement | null>(null)
  const [comment, setComment] = React.useState('')

  React.useLayoutEffect(() => {
    const pill = pillRef.current
    if (pill === null) return
    const { width, height } = pill.getBoundingClientRect()
    const anchor = props.pending.anchor
    const above = anchor.top - PILL_GAP - height
    pill.style.left = `${Math.round(clamp(
      anchor.left + anchor.width / 2 - width / 2,
      VIEWPORT_MARGIN,
      Math.max(VIEWPORT_MARGIN, window.innerWidth - VIEWPORT_MARGIN - width),
    ))}px`
    // Flip under the selection when the passage starts too close to the top
    // edge; a pill pinned to the margin would otherwise cover what it quotes.
    pill.style.top = `${Math.round(above >= VIEWPORT_MARGIN ? above : anchor.bottom + PILL_GAP)}px`
    pill.style.visibility = 'visible'
  }, [props.pending, props.commenting])

  const quoteHint = props.full ? `一条消息最多引用 ${props.limits.maxQuotes} 处` : undefined

  return (
    <div
      ref={pillRef}
      className="qsl-pill"
      style={{ visibility: 'hidden', left: 0, top: 0 }}
      // Pressing anywhere on the pill would clear the very selection it acts
      // on, so the press is refused before it reaches the document — except in
      // comment mode, where the press has to land in the field to place a caret.
      onMouseDown={event => { if (!props.commenting) event.preventDefault() }}
    >
      {props.commenting ? (
        <>
          <input
            autoFocus
            className="qsl-commentField"
            value={comment}
            maxLength={props.limits.maxCommentLength}
            placeholder="写句评论，回车加入…"
            aria-label="为这条引用写评论"
            onChange={event => { setComment(event.target.value) }}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                props.onCommit(comment)
              }
              if (event.key === 'Escape') props.onDismiss()
            }}
          />
          <button
            type="button"
            className="qsl-confirm"
            aria-label="加入引用"
            onClick={() => { props.onCommit(comment) }}
          >
            <IconCheckOutline14 size={14} />
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="qsl-action"
            aria-disabled={props.full}
            title={quoteHint}
            onClick={() => { if (!props.full) props.onCommit('') }}
          >
            <QuoteGlyph />
            引用
          </button>
          <span className="qsl-divider" aria-hidden="true" />
          <button
            type="button"
            className="qsl-action"
            aria-disabled={props.full}
            title={quoteHint ?? '先写一句评论再加入'}
            onClick={() => { if (!props.full) props.onStartComment() }}
          >
            <CommentGlyph />
            评论
          </button>
        </>
      )}
    </div>
  )
}

/**
 * The badge layer over the transcript. Positions come from live ranges rather
 * than from React state, so they follow reflow; recomputing on scroll and
 * resize is what keeps them attached, and a passage whose message re-rendered
 * yields no rect and simply stops being drawn.
 */
function QuoteBadges({ rangesRef, count }: { rangesRef: React.MutableRefObject<Range[]>; count: number }): React.ReactElement | null {
  const [placements, setPlacements] = React.useState<BadgePlacement[]>([])

  React.useEffect(() => {
    let frame: number | null = null
    const recompute = (): void => {
      frame = null
      setPlacements(placeQuoteBadges(rangesRef.current))
    }
    const schedule = (): void => {
      if (frame === null) frame = requestAnimationFrame(recompute)
    }
    recompute()
    // Capture phase: the conversation scrolls in its own scrollport, not the
    // window, and only a capturing listener sees that.
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
  }, [rangesRef, count])

  if (placements.length === 0) return null

  return createPortal(
    <>
      {placements.map(placement => (
        <span
          key={placement.index}
          className="qsl-badge"
          aria-hidden="true"
          style={{ top: placement.top, left: placement.left }}
        >
          {placement.index + 1}
        </span>
      ))}
    </>,
    document.body,
  )
}

interface QuoteStripProps {
  readonly quotes: readonly Quote[]
  /** Live limits from the plugin's settings section. */
  readonly limits: QuoteSelectSettings
  readonly onEditComment: (index: number, comment: string) => void
  readonly onRemove: (index: number) => void
  readonly onClear: () => void
}

/**
 * The strip above the composer: what is currently attached to this message.
 * Expansion is a click, not a hover — comments are edited in place here, and a
 * panel that closes when the pointer leaves it cannot hold a text field.
 */
function QuoteStrip(props: QuoteStripProps): React.ReactElement {
  const [expanded, setExpanded] = React.useState(false)

  return (
    <section className="qsl-strip" aria-label="待发送的引用">
      <div className="qsl-head">
        <button
          type="button"
          className="qsl-summary"
          aria-expanded={expanded}
          onClick={() => { setExpanded(open => !open) }}
        >
          <span className="qsl-mark"><QuoteGlyph /></span>
          <span className="qsl-count">{props.quotes.length} 条引用</span>
          {expanded ? null : <span className="qsl-peek">{props.quotes[0]?.text}</span>}
          <IconChevronDownOutline14
            size={14}
            className={expanded ? 'qsl-chevron qsl-chevron--open' : 'qsl-chevron'}
          />
        </button>
        <button
          type="button"
          className="qsl-iconButton"
          title="清空引用"
          aria-label="清空引用"
          onClick={props.onClear}
        >
          <IconCloseOutline16 size={14} />
        </button>
      </div>
      {expanded ? (
        <ol className="qsl-list">
          {props.quotes.map((quote, index) => (
            <li className="qsl-item" key={index}>
              <span className="qsl-index" aria-hidden="true">{index + 1}</span>
              <div className="qsl-body">
                <div className="qsl-text">
                  {quote.role === 'unknown' ? null : <span className="qsl-role">{ROLE_TEXT[quote.role]}</span>}
                  {quote.text}
                </div>
                <input
                  className="qsl-comment"
                  value={quote.comment}
                  maxLength={props.limits.maxCommentLength}
                  placeholder="添加评论（可选）"
                  aria-label={`第 ${index + 1} 条引用的评论`}
                  onChange={event => { props.onEditComment(index, event.target.value) }}
                />
              </div>
              <button
                type="button"
                className="qsl-iconButton"
                title="删除这条引用"
                aria-label={`删除第 ${index + 1} 条引用`}
                onClick={() => { props.onRemove(index) }}
              >
                <IconCloseOutline16 size={14} />
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}

/**
 * Client plugin body: own the injected stylesheet for the plugin's lifetime and
 * seat the dock entry. The entry component is defined here so it closes over
 * this plugin's ctx.
 * @param ctx - this plugin's client context.
 */
export function apply(ctx: any): void {
  // Package-owned stylesheet (cleaned up with the plugin fiber).
  const styleEl = document.createElement('style')
  styleEl.textContent = CSS
  document.head.appendChild(styleEl)
  ctx.effect(() => () => {
    styleEl.remove()
  })

  const settingsStore = createSettingsStore()

  /*
   * Bind the durable limits when the settings surface is composed. Nested
   * rather than declared in `inject` above: quoting is the plugin's product and
   * the limits are a refinement, so a composition without settings must still
   * quote — at the schema defaults. `connection` and `remote` come with the
   * binder's own contract, which reads the transport off the caller's context
   * and registers the invalidation subscription on the caller's fiber.
   */
  ctx.inject(['settingsScope', 'connection', 'remote'], (settingsCtx: any) => {
    settingsCtx.effect(
      () => settingsStore.attach(settingsCtx.settingsScope.bind({ namespace: QUOTE_SELECT_NAMESPACE })),
      'quote-select: limits section',
    )
  })

  /** The dock entry: selection listener, quote store, and all three surfaces. */
  function QuoteDock(props: any): React.ReactElement | null {
    const { quotes, body } = parseDraft(props.input.draft as string)
    // Limits are read per render rather than captured: lowering one in the
    // settings card takes effect on the next quote without a reload.
    const [limits, setLimits] = React.useState(settingsStore.get)
    React.useEffect(() => settingsStore.subscribe(() => setLimits(settingsStore.get())), [])
    const [pending, setPending] = React.useState<PendingSelection | null>(null)
    const [commenting, setCommenting] = React.useState(false)

    /**
     * Live ranges of the collected quotes, positionally aligned with `quotes`.
     * They cannot live in the draft (a Range is not text), so alignment is
     * maintained by every mutation below and re-checked whenever the count
     * changes: a hand-edit of the quote lines in the textarea moves quotes the
     * ranges know nothing about, and dropping the highlight beats misplacing it.
     */
    const rangesRef = React.useRef<Range[]>([])

    /**
     * Mirrors `commenting` for the event handlers. The comment field takes focus
     * the moment it mounts, which collapses the document selection; the mouseup
     * that opened it is still queued behind that, and would run with a stale
     * closure and dismiss the pill the user just asked for. A ref written in the
     * same tick is what the queued handler reads.
     */
    const commentingRef = React.useRef(false)

    const dismiss = React.useCallback(() => {
      commentingRef.current = false
      setCommenting(false)
      setPending(null)
    }, [])

    React.useEffect(() => {
      let deferred = 0
      const sync = (): void => {
        if (commentingRef.current) return
        const selection = window.getSelection()
        const text = selection === null ? '' : selection.toString()
        if (selection === null || selection.isCollapsed || text.trim() === '') {
          setPending(null)
          return
        }
        // Only the anchor is tested, so a selection dragged across several
        // messages is quoted as one passage from where it started rather than
        // being refused outright.
        const source = resolveQuoteSource(selection.anchorNode)
        if (source === null) {
          setPending(null)
          return
        }
        const range = selection.getRangeAt(0)
        const anchor = range.getBoundingClientRect()
        if (anchor.width === 0 && anchor.height === 0) {
          setPending(null)
          return
        }
        setPending({ text, role: source.role, range: range.cloneRange(), anchor })
      }
      // Deferred a task: on a click that only collapses an existing selection,
      // mouseup still reports the old selection.
      const onMouseUp = (): void => {
        window.clearTimeout(deferred)
        deferred = window.setTimeout(sync, 0)
      }
      // While a comment is being written the selection is gone and `sync` is
      // muted, so nothing else would ever retire the pill: pressing anywhere
      // outside it is what abandons the unfinished comment.
      const onMouseDown = (event: MouseEvent): void => {
        if (!commentingRef.current) return
        if (event.target instanceof Element && event.target.closest('.qsl-pill') !== null) return
        dismiss()
      }
      const onKeyUp = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') {
          dismiss()
          return
        }
        if (event.shiftKey) sync()
      }
      // The pill is anchored to a rect measured once. Rather than re-measuring
      // against a moving viewport, scrolling simply retires it — except while a
      // comment is being written, where that would discard the typed text.
      const onViewportChange = (): void => {
        if (commentingRef.current) return
        setPending(null)
      }

      document.addEventListener('mouseup', onMouseUp)
      document.addEventListener('mousedown', onMouseDown)
      document.addEventListener('keyup', onKeyUp)
      window.addEventListener('scroll', onViewportChange, true)
      window.addEventListener('resize', onViewportChange)
      return () => {
        window.clearTimeout(deferred)
        document.removeEventListener('mouseup', onMouseUp)
        document.removeEventListener('mousedown', onMouseDown)
        document.removeEventListener('keyup', onKeyUp)
        window.removeEventListener('scroll', onViewportChange, true)
        window.removeEventListener('resize', onViewportChange)
      }
    }, [dismiss])

    React.useEffect(() => {
      if (rangesRef.current.length !== quotes.length) rangesRef.current = []
      paintQuoteHighlight(rangesRef.current)
    }, [quotes.length])

    // The highlight registry is document-wide; leaving the seat must clear it.
    React.useEffect(() => () => { paintQuoteHighlight([]) }, [])

    const writeQuotes = (next: readonly Quote[]): void => {
      props.inputActions.setDraft(composeDraft(next, body))
    }

    const commit = (comment: string): void => {
      if (pending === null || quotes.length >= limits.maxQuotes) return
      const aligned = rangesRef.current.length === quotes.length ? rangesRef.current : []
      rangesRef.current = [...aligned, pending.range]
      writeQuotes([...quotes, {
        text: normalizeQuoteText(pending.text, limits.maxQuoteLength),
        // One-shot commit, so this one IS trimmed; the strip's live editing is
        // the case that must not be.
        comment: sanitizeComment(comment.trim(), limits.maxCommentLength),
        role: pending.role,
      }])
      window.getSelection()?.removeAllRanges()
      dismiss()
      focusComposerAtEnd()
    }

    const removeAt = (index: number): void => {
      if (rangesRef.current.length === quotes.length) {
        rangesRef.current = rangesRef.current.filter((_, at) => at !== index)
      }
      writeQuotes(quotes.filter((_, at) => at !== index))
    }

    const pill = pending === null ? null : createPortal(
      <SelectionPill
        pending={pending}
        full={quotes.length >= limits.maxQuotes}
        limits={limits}
        commenting={commenting}
        onStartComment={() => {
          commentingRef.current = true
          setCommenting(true)
        }}
        onCommit={commit}
        onDismiss={dismiss}
      />,
      document.body,
    )

    // Every surface but the strip is a portal, so an idle seat adds no element
    // — and therefore no gap — to the composer stack.
    if (quotes.length === 0) return pill

    return (
      <>
        <QuoteBadges rangesRef={rangesRef} count={quotes.length} />
        <QuoteStrip
          quotes={quotes}
          limits={limits}
          onEditComment={(index, comment) => {
            writeQuotes(quotes.map((quote, at) => (at === index ? { ...quote, comment: sanitizeComment(comment, limits.maxCommentLength) } : quote)))
          }}
          onRemove={removeAt}
          onClear={() => {
            rangesRef.current = []
            writeQuotes([])
          }}
        />
        {pill}
      </>
    )
  }

  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register(
    { name: 'conversation.input.dock', id: 'quote-select', order: SLOT_ORDER },
    (props: any) => React.createElement(QuoteDock, props),
  ))

  // Keyed on the namespace: the configurable-plugins tab pairs this card with
  // the section the Host half registered under the same key, and never learns
  // what either means. The seat exists only while that tab is mounted, which is
  // what `slots.inject` waits for.
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register(
    { name: 'settings.plugin.item', key: QUOTE_SELECT_NAMESPACE },
    () => React.createElement(SettingsCard, { store: settingsStore }),
  ))
}
