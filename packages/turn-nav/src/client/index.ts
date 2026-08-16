/**
 * Turn navigation rail plugin, browser half: a hover-reveal rail at the
 * conversation's left edge (shell.overlay). One line per turn (user message +
 * its AI reply). Each line's resting length encodes the turn's weight (chat
 * nodes, log-scaled), so the rail reads as a fingerprint of the conversation
 * rather than a uniform comb. Pointer proximity drives a distance-falloff wave
 * (length / thickness / luminance), scrolling moves the wave peak with the
 * reading position and marks the current turn in the accent color, clicking
 * jumps to that turn, and hovering shows a preview card.
 *
 * Two visual channels carry two different meanings and never compete: the
 * transient pointer wave is achromatic (label-tertiary to label-primary) while
 * the persistent reading position is the accent hue. Per-frame updates write a
 * single `--tnv-w` custom property per line and let CSS derive every visual
 * from it, so pointer tracking never re-renders React.
 *
 * Data: root-scope overlay has no `useSession` standard prop, so the
 * conversation snapshot is subscribed directly through
 * `sessions.binding(id).session` (an ObservableSnapshot). DOM anchors:
 * `[data-conversation-scroll]` is the chat scrollport and
 * `[data-chat-anchor-key]` marks each rendered node.
 *
 * A switch in the sidebar foot (`sidebar.footer.action`) shows and hides the
 * rail. It lives here rather than in its own plugin because the state it owns
 * is this plugin's own visibility — no seam between two plugins to define.
 */

import * as React from 'react'
// A platform module, so this stays an external the shell's frozen table answers.
import { IconListPenOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'

export const inject = ['slots', 'sessions', 'timer']

/**
 * Where the rail's on/off state is kept. A settings namespace would be the
 * product-native home, but the api-proxy serves only an allowlist of them and a
 * plugin distributed outside the harness cannot join it, so this preference is
 * browser-local rather than part of the settings document.
 */
const VISIBILITY_KEY = 'dsh-plugin-turn-nav.visible'
/** Sidebar foot order: above the theme switch, which sits at 10. */
const TOGGLE_SLOT_ORDER = 5

/** Vertical pitch per turn, clamped so long conversations still fit before the rail scrolls. */
const STEP_MIN = 8
const STEP_MAX = 16
/** Resting line length: `LEN_BASE` for a one-node turn, plus up to `LEN_SPAN` more as weight saturates. */
const LEN_BASE = 7
const LEN_SPAN = 13
/**
 * Chat-node count that reaches full length. Tuned near the size of an ordinary
 * multi-step turn so everyday turns spread across the scale instead of piling
 * up at one length; heavier turns saturate rather than dwarfing the rail.
 */
const LEN_SATURATION = 24
/** Pointer falloff distance, in pitch steps, at which the wave weight reaches zero. */
const FALLOFF_STEPS = 2.2
/** Gap between the rail and the preview card, and the margin the card is clamped to inside the viewport. */
const CARD_GAP = 10
const CARD_MARGIN = 12
/** Margin kept between the current line and the track edge when the rail auto-scrolls. */
const TRACK_REVEAL_MARGIN = 20
/** Delay before the rail fades back after conversation scrolling stops. */
const SCROLL_REST_MS = 400
/** Scroll distance from the end still counted as "at the bottom", absorbing fractional scroll offsets. */
const BOTTOM_EPSILON = 4
/**
 * Window in which a click's scroll must produce its first scroll event. A click
 * whose target is already in place scrolls nothing and would otherwise leave the
 * index pinned forever; once any scroll arrives, settling owns the pin instead.
 */
const PIN_SAFETY_MS = 150

const CSS = `
  .tnv {
    position: fixed;
    z-index: 50;
    /* Wide enough for the longest line at full wave (LEN_BASE + LEN_SPAN + current + wave). */
    width: 42px;
    padding-left: 4px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    pointer-events: auto;
    /* Idle multiplier folded into each line's opacity; the current turn ignores it. */
    --tnv-idle: 0.55;
  }
  .tnv:hover,
  .tnv--active {
    --tnv-idle: 1;
  }
  .tnv-track {
    position: relative;
    max-height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
  }
  .tnv-track::-webkit-scrollbar {
    width: 0;
    height: 0;
  }
  /* Edge fade only while the rail actually scrolls, so a fitting rail never hides its first turn. */
  .tnv--overflow .tnv-track {
    -webkit-mask-image: linear-gradient(to bottom, transparent 0, black 18px, black calc(100% - 18px), transparent 100%);
    mask-image: linear-gradient(to bottom, transparent 0, black 18px, black calc(100% - 18px), transparent 100%);
  }
  /* Full-pitch transparent hit target: every y on the rail belongs to a turn, leaving no dead gaps. */
  .tnv-slot {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    width: 100%;
    cursor: pointer;
  }
  .tnv-slot:focus-visible .tnv-line {
    outline: 2px solid var(--dsw-alias-state-business-primary);
    outline-offset: 3px;
  }
  .tnv-line {
    height: 2px;
    border-radius: 999px;
    transform-origin: left center;
    width: calc((var(--tnv-base, 8) + var(--tnv-cur, 0) * 4 + var(--tnv-w, 0) * 12) * 1px);
    transform: scaleY(calc(1 + var(--tnv-w, 0) + var(--tnv-cur, 0) * 0.5));
    /* max() keeps the current turn fully opaque through the idle fade. */
    opacity: max(calc((0.34 + var(--tnv-w, 0) * 0.66) * var(--tnv-idle)), var(--tnv-cur, 0));
    background: color-mix(in srgb,
      var(--dsw-alias-label-primary) calc(var(--tnv-w, 0) * 100%),
      var(--dsw-alias-label-tertiary));
    transition:
      width 0.13s cubic-bezier(0.22, 0.61, 0.36, 1),
      transform 0.13s cubic-bezier(0.22, 0.61, 0.36, 1),
      opacity 0.16s ease,
      background-color 0.16s ease;
  }
  /* Reading position: the one persistent, chromatic mark on the rail. */
  .tnv-slot--current .tnv-line {
    background: var(--dsw-alias-state-business-primary);
    box-shadow: 0 0 0 2.5px color-mix(in srgb, var(--dsw-alias-state-business-primary) 15%, transparent);
  }

  /*
   * Preview card. The surface matches the app's own hover card (#2C2C2E in both
   * themes, from ui-primitives HoverCard), so its foreground colors are
   * component constants rather than theme tokens — theme tokens would invert
   * against a surface that does not.
   */
  .tnv-card {
    --tnv-card-fg: #F9FAFB;
    --tnv-card-accent: #5686FE;
    position: fixed;
    z-index: 60;
    box-sizing: border-box;
    width: 300px;
    max-width: calc(100vw - 40px);
    padding: 11px 14px 12px;
    border-radius: 12px;
    background: color-mix(in srgb, #2C2C2E 94%, transparent);
    -webkit-backdrop-filter: blur(16px) saturate(1.2);
    backdrop-filter: blur(16px) saturate(1.2);
    box-shadow:
      0 16px 40px -12px rgba(0, 0, 0, 0.42),
      0 2px 8px -2px rgba(0, 0, 0, 0.24);
    color: var(--tnv-card-fg);
    pointer-events: none;
    animation: tnv-card-in 0.14s cubic-bezier(0.22, 0.61, 0.36, 1);
  }
  @keyframes tnv-card-in {
    from {
      opacity: 0;
      transform: translateY(3px);
    }
  }
  .tnv-card-head {
    display: flex;
    align-items: baseline;
    gap: 5px;
    margin-bottom: 6px;
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    line-height: 1;
  }
  .tnv-card-index {
    font-weight: 650;
    color: var(--tnv-card-accent);
  }
  .tnv-card-total {
    color: rgba(249, 250, 251, 0.42);
  }
  .tnv-card-size {
    margin-left: auto;
    color: rgba(249, 250, 251, 0.42);
  }
  .tnv-card-title {
    font-size: 13px;
    line-height: 1.45;
    font-weight: 600;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .tnv-card-reply {
    margin-top: 7px;
    padding-top: 7px;
    border-top: 1px solid rgba(249, 250, 251, 0.12);
    font-size: 12px;
    line-height: 1.55;
    color: rgba(249, 250, 251, 0.62);
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .tnv-card-placeholder {
    color: rgba(249, 250, 251, 0.38);
  }

  @media (prefers-reduced-motion: reduce) {
    .tnv-line {
      transform: none;
      transition: none;
    }
    .tnv-card {
      animation: none;
    }
  }

  /*
   * Sidebar switch. Mirrors the Settings trigger row (ui-settings-general
   * SettingsRoot.module.css, .trigger and .trigger.rail) value for value so the
   * sidebar foot reads as one control group; the harness's class names are
   * hashed per build and cannot be targeted from here, so a restyle upstream
   * needs the same edit here.
   */
  /*
   * The sidebar foot lays its actions out in one nowrap flex row, so two
   * full-width rows would overlap instead of stacking. Matched by the CSS
   * module's local-name suffix because the harness hashes the prefix per build;
   * every plugin seating a full-width row there declares the same rule, which
   * is idempotent when more than one is installed.
   */
  [class*="_footerActions"] {
    flex-wrap: wrap;
  }
  .tnv-row {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    width: calc(100% + 8px);
    height: 34px;
    margin: 4px -4px 4px;
    padding: 6px 2px 6px 10px;
    box-sizing: border-box;
    border: none;
    border-radius: 12px;
    background: transparent;
    cursor: pointer;
    overflow: hidden;
    color: var(--dsw-alias-label-primary);
    font-family: inherit;
    font-size: 14px;
    line-height: 22px;
  }
  .tnv-row:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
  .tnv-row:focus-visible {
    outline: 2px solid var(--dsw-alias-state-business-primary);
    outline-offset: -2px;
  }
  /* Off: the row stays legible but recedes, so the state reads without a second control. */
  .tnv-row--off {
    color: var(--dsw-alias-label-tertiary);
  }
  .tnv-row--rail {
    width: 36px;
    height: 36px;
    margin: 8px 0 10px;
    justify-content: center;
    gap: 0;
    padding: 0;
    border-radius: 50%;
  }
  .tnv-row svg {
    flex: none;
    display: block;
  }
  .tnv-row-label {
    overflow: hidden;
    white-space: nowrap;
  }
`

/** The rail's on/off state, shared by the rail and its sidebar switch. */
interface Visibility {
  get: () => boolean
  toggle: () => void
  subscribe: (listener: () => void) => () => void
}

/** Build the visibility store, restoring the last browser-local choice. */
function createVisibility(): Visibility {
  const listeners = new Set<() => void>()
  let visible = true
  try {
    visible = window.localStorage.getItem(VISIBILITY_KEY) !== 'off'
  } catch {
    // Storage unreachable (private mode, blocked site data). The rail has no
    // other durable home, so it starts visible and this session simply forgets.
  }
  return {
    get: () => visible,
    toggle: () => {
      visible = !visible
      try {
        window.localStorage.setItem(VISIBILITY_KEY, visible ? 'on' : 'off')
      } catch {
        // Same unreachable storage; the toggle still applies for this session.
      }
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** Subscribe a component to the visibility store. */
function useVisible(visibility: Visibility): boolean {
  const [visible, setVisible] = React.useState(visibility.get)
  React.useEffect(() => visibility.subscribe(() => setVisible(visibility.get())), [visibility])
  return visible
}

/** Extract text from a block list (accepts both ContentBlock and AssistantBlock shapes). */
function textOfBlocks(content: any): string {
  const list = Array.isArray(content) ? content : []
  return list
    .filter((b: any) => b && (b.type === 'text' || b.kind === 'text') && typeof b.text === 'string')
    .map((b: any) => b.text)
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim()
}

/** One rail entry: the turn's anchor key, its preview text, and its node count (drives resting length). */
interface Turn {
  key: string
  title: string
  reply: string
  size: number
}

/** Group chat nodes into turns: a user node opens a turn; the turn-tail closing assistant fills the reply. */
function buildTurns(snap: any): Turn[] {
  const chat = snap && snap.chat
  if (!chat || !chat.order || !chat.nodes) return []
  const turns: Turn[] = []
  let current: Turn | null = null
  for (const key of chat.order) {
    const node = chat.nodes.get(key)
    if (!node) continue
    if (node.kind === 'user') {
      current = { key, title: textOfBlocks(node.data && node.data.content), reply: '', size: 1 }
      turns.push(current)
      continue
    }
    if (!current) continue
    current.size++
    if (node.kind === 'turn-tail') {
      const closing = node.data && node.data.closing
      if (closing && closing.finalNode) {
        const reply = textOfBlocks(closing.finalNode.blocks)
        if (reply) current.reply = reply
      }
    } else if (node.kind === 'assistant-step') {
      const data = node.data
      if (data && data.status === 'settled' && data.blocks) {
        const reply = textOfBlocks(data.blocks)
        if (reply) current.reply = reply
      }
    }
  }
  return turns
}

/** Resting line length in px: log-scaled node count, so a heavy turn reads long without dwarfing the rest. */
function restingLength(size: number): number {
  const ratio = Math.log(Math.max(1, size)) / Math.log(LEN_SATURATION)
  return LEN_BASE + LEN_SPAN * Math.min(1, ratio)
}

/** Subscribe to an ObservableSnapshot with plain state/effect (no uSES dependency). */
function useObservable(store: any): any {
  const [snap, setSnap] = React.useState<any>(() => (store ? store.getSnapshot() : undefined))
  React.useEffect(() => {
    if (!store) return undefined
    setSnap(store.getSnapshot())
    return store.subscribe(() => setSnap(store.getSnapshot()))
  }, [store])
  return snap
}

/** Measure the conversation scrollport rect (geometry for the fixed rail). */
function useConversationGeometry(currentId: any): any {
  const [geom, setGeom] = React.useState<any>(null)
  React.useEffect(() => {
    if (!currentId) return undefined
    const el = document.querySelector('[data-conversation-scroll]')
    if (!el) return undefined
    const measure = () => {
      const r = (el as HTMLElement).getBoundingClientRect()
      if (r.width > 0) setGeom({ left: r.left, top: r.top, height: r.height })
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    if (ro) ro.observe(el as Element)
    window.addEventListener('resize', measure)
    return () => {
      if (ro) ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [currentId])
  return geom
}

/**
 * Scroll linkage: reveal the rail while scrolling, move the wave peak with the
 * reading position, and mark the current turn index. The current index survives
 * the debounce so the marker stays after scrolling stops.
 *
 * The anchor map and the painter are read through refs because both change on
 * every snapshot while this subscription is keyed only to the session.
 * `pointerPeakRef` holds the pointer's wave peak, or null when the pointer is
 * off the rail: settling hands the wave back to it rather than clearing a wave
 * the pointer is still driving.
 *
 * `pinRef` carries the clicked turn across that click's smooth scroll:
 * `{ index, safety }`, where `index` is the pinned turn (null when unpinned) and
 * `safety` disposes the timer that unpins a click which scrolled nothing.
 */
function useScrollReveal(ctx: any, currentId: any, keyToIndexRef: any, turnCountRef: any, paintRef: any, pointerPeakRef: any, pinRef: any, railElRef: any): any {
  const [currentIndex, setCurrentIndex] = React.useState(0)
  React.useEffect(() => {
    if (!currentId) return undefined
    const el = document.querySelector('[data-conversation-scroll]')
    if (!el) return undefined
    let debounce: any = null
    let raf: any = null
    /**
     * Turn the reader is on: the turn owning the first anchor at or below the
     * scrollport top. At the end of the scroll range no anchor can reach the top
     * — the scrollport has nothing left to scroll — so the last turn is the
     * answer there regardless of which anchor sits under the top edge.
     */
    const readingIndex = (scrollport: HTMLElement): number => {
      const last = Math.max(0, turnCountRef.current - 1)
      if (scrollport.scrollTop >= scrollport.scrollHeight - scrollport.clientHeight - BOTTOM_EPSILON) return last
      const top = scrollport.getBoundingClientRect().top
      for (const a of Array.from(scrollport.querySelectorAll('[data-chat-anchor-key]'))) {
        if ((a as HTMLElement).getBoundingClientRect().top >= top - 2) {
          const idx = keyToIndexRef.current.get(a.getAttribute('data-chat-anchor-key'))
          if (idx !== undefined) return idx
        }
      }
      return last
    }
    const update = () => {
      raf = null
      const railEl = railElRef.current
      if (railEl) railEl.classList.add('tnv--active')
      // A scroll arrived, so the click's scroll is under way: settling below now
      // owns the pin and the no-scroll safety timer is no longer needed.
      if (pinRef.safety) {
        pinRef.safety()
        pinRef.safety = null
      }
      // A click states the turn outright; the reading heuristic must not
      // override it while that click's own smooth scroll is still running.
      const index = pinRef.index !== null ? pinRef.index : readingIndex(el as HTMLElement)
      setCurrentIndex(index)
      // Wave peak sits ON the marked turn's line — one unified indicator.
      paintRef.current(index)
      if (debounce) debounce()
      debounce = ctx.timeout(() => {
        pinRef.index = null
        if (railElRef.current) railElRef.current.classList.remove('tnv--active')
        paintRef.current(pointerPeakRef.current)
      }, SCROLL_REST_MS)
    }
    const onScroll = () => {
      if (raf === null) raf = requestAnimationFrame(update)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (raf !== null) cancelAnimationFrame(raf)
      if (debounce) debounce()
    }
  }, [currentId])
  return { currentIndex, setCurrentIndex }
}

/**
 * Client plugin body: register the rail into the frame-wide overlay and own
 * the injected stylesheet for the plugin's lifetime. The component is defined
 * here so it closes over this plugin's ctx.
 */
export function apply(ctx: any): void {
  // Package-owned stylesheet (cleaned up with the plugin fiber).
  const styleEl = document.createElement('style')
  styleEl.textContent = CSS
  document.head.appendChild(styleEl)
  ctx.effect(() => () => {
    styleEl.remove()
  })

  const visibility = createVisibility()

  /** The sidebar-foot switch that shows and hides the rail. */
  function RailToggle(props: any): React.ReactElement {
    const visible = useVisible(visibility)
    const wide = props.wide !== false
    const action = visible ? '隐藏快捷导航' : '显示快捷导航'
    return React.createElement('button', {
      type: 'button',
      className: 'tnv-row' + (wide ? '' : ' tnv-row--rail') + (visible ? '' : ' tnv-row--off'),
      title: action,
      'aria-label': action,
      'aria-pressed': visible ? 'true' : 'false',
      onClick: () => visibility.toggle(),
    },
      React.createElement(IconListPenOutline16, { size: 16 }),
      wide ? React.createElement('span', { className: 'tnv-row-label' }, '快捷导航') : null,
    )
  }

  /** The rail component (created once per activation, so hook state is stable). */
  function TurnNav(props: any): React.ReactElement {
    const visible = useVisible(visibility)
    const railRef = React.useRef<any>(null)
    const trackRef = React.useRef<any>(null)
    const slotRefs = React.useRef<any[]>([])
    const cardRef = React.useRef<any>(null)

    const currentId = props.useSessions((s: any) => s.current)
    const binding = currentId ? ctx.sessions.binding(currentId) : undefined
    const snap = useObservable(binding && binding.session)
    const turns = React.useMemo(() => buildTurns(snap), [snap])
    // node key → turn index (every node between two user messages belongs to the turn opened by the first).
    const keyToIndex = React.useMemo(() => {
      const m = new Map<string, number>()
      const chat = snap && snap.chat
      let idx = -1
      if (chat && chat.order && chat.nodes) {
        for (const key of chat.order) {
          const node = chat.nodes.get(key)
          if (!node) continue
          if (node.kind === 'user') idx++
          if (idx >= 0) m.set(key, idx)
        }
      }
      return m
    }, [snap])
    const keyToIndexRef = React.useRef(keyToIndex)
    keyToIndexRef.current = keyToIndex

    const geom = useConversationGeometry(currentId)
    const [hoverIndex, setHoverIndex] = React.useState(-1)
    const [overflow, setOverflow] = React.useState(false)

    const railHeight = geom ? Math.max(120, geom.height - 140) : 0
    const step = Math.max(STEP_MIN, Math.min(STEP_MAX, railHeight / Math.max(1, turns.length)))

    /**
     * Write the wave weight of every line for one peak position, expressed in
     * fractional turn indices (null clears the wave). Bypassing React keeps
     * pointer tracking to one custom-property write per line per frame.
     */
    const paint = (peak: number | null) => {
      const slots = slotRefs.current
      for (let i = 0; i < slots.length; i++) {
        const el = slots[i]
        if (!el) continue
        const w = peak === null ? 0 : Math.max(0, 1 - Math.abs(peak - i) / FALLOFF_STEPS)
        el.firstChild.style.setProperty('--tnv-w', w.toFixed(3))
      }
    }
    const paintRef = React.useRef(paint)
    paintRef.current = paint
    // Pointer wave peak in fractional turn indices; null whenever the pointer is off the rail.
    const pointerPeakRef = React.useRef<any>(null)
    // Clicked turn held across that click's smooth scroll; see useScrollReveal.
    const pinRef = React.useRef<any>({ index: null, safety: null }).current

    const turnCountRef = React.useRef(turns.length)
    turnCountRef.current = turns.length
    const { currentIndex, setCurrentIndex } = useScrollReveal(ctx, currentId, keyToIndexRef, turnCountRef, paintRef, pointerPeakRef, pinRef, railRef)

    // Auto-extend the history window so the rail lists EVERY turn, not just the
    // initially loaded window: while the snapshot still reports hasMore, request
    // the next older page; each arrival bumps the snapshot and re-triggers this.
    React.useEffect(() => {
      if (!binding || !snap || !snap.hasMore) return undefined
      binding.session.loadOlder().catch(() => {})
      return undefined
    }, [snap])

    // rAF-throttled pointer tracking: the wave follows the pointer continuously,
    // including across the padding between one line and the next.
    const pointerRaf = React.useRef<any>(null)
    const pointerY = React.useRef(0)
    React.useEffect(() => () => {
      if (pointerRaf.current !== null) cancelAnimationFrame(pointerRaf.current)
      if (pinRef.safety) pinRef.safety()
    }, [])

    // Keep the marked turn inside the track once the rail is long enough to scroll.
    React.useLayoutEffect(() => {
      const track = trackRef.current
      const slot = slotRefs.current[currentIndex]
      if (!track || !slot) return
      const scrollable = track.scrollHeight > track.clientHeight + 1
      setOverflow(scrollable)
      if (!scrollable) return
      const top = slot.offsetTop
      const bottom = top + slot.offsetHeight
      if (top < track.scrollTop + TRACK_REVEAL_MARGIN) {
        track.scrollTop = Math.max(0, top - TRACK_REVEAL_MARGIN)
      } else if (bottom > track.scrollTop + track.clientHeight - TRACK_REVEAL_MARGIN) {
        track.scrollTop = bottom - track.clientHeight + TRACK_REVEAL_MARGIN
      }
    }, [currentIndex, turns.length, step, railHeight])

    // Place the card against its line after measuring: clamped to the viewport,
    // flipped to the rail's left when the right side cannot hold it.
    React.useLayoutEffect(() => {
      const card = cardRef.current
      const slot = slotRefs.current[hoverIndex]
      const rail = railRef.current
      if (!card || !slot || !rail) return
      const slotRect = slot.getBoundingClientRect()
      const railRect = rail.getBoundingClientRect()
      const width = card.offsetWidth
      const height = card.offsetHeight
      let x = railRect.right + CARD_GAP
      if (x + width > window.innerWidth - CARD_MARGIN) x = railRect.left - CARD_GAP - width
      const y = slotRect.top + slotRect.height / 2 - height / 2
      card.style.left = Math.max(CARD_MARGIN, x) + 'px'
      card.style.top = Math.max(CARD_MARGIN, Math.min(window.innerHeight - CARD_MARGIN - height, y)) + 'px'
      card.style.visibility = 'visible'
    }, [hoverIndex])

    if (!visible || !geom || turns.length === 0) return React.createElement('div', null)

    const jumpTo = (key: string, index: number) => {
      // Mark the clicked turn immediately, not waiting for the smooth scroll to
      // settle, and hold it there: a turn within one viewport of the end cannot
      // reach the scrollport top, so the reading heuristic would otherwise
      // resolve the scroll to a different turn and overwrite this one.
      setCurrentIndex(index)
      paint(index)
      pinRef.index = index
      if (pinRef.safety) pinRef.safety()
      pinRef.safety = ctx.timeout(() => {
        pinRef.index = null
        pinRef.safety = null
      }, PIN_SAFETY_MS)
      const nodes = document.querySelectorAll('[data-chat-anchor-key]')
      for (const el of nodes) {
        if (el.getAttribute('data-chat-anchor-key') === key) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          break
        }
      }
    }

    const onTrackMove = (ev: any) => {
      const track = trackRef.current
      if (!track) return
      const r = track.getBoundingClientRect()
      pointerY.current = ev.clientY - r.top + track.scrollTop
      if (pointerRaf.current !== null) return
      pointerRaf.current = requestAnimationFrame(() => {
        pointerRaf.current = null
        pointerPeakRef.current = pointerY.current / step - 0.5
        paintRef.current(pointerPeakRef.current)
      })
    }

    const slotEls = turns.map((turn, i) => {
      const isCurrent = i === currentIndex
      const line = React.createElement('div', {
        className: 'tnv-line',
        style: {
          '--tnv-base': restingLength(turn.size).toFixed(1),
          '--tnv-cur': isCurrent ? '1' : '0',
        },
      })
      return React.createElement('button', {
        key: turn.key,
        type: 'button',
        className: 'tnv-slot' + (isCurrent ? ' tnv-slot--current' : ''),
        style: { height: step + 'px' },
        ref: (el: any) => {
          slotRefs.current[i] = el
        },
        'aria-label': '第 ' + (i + 1) + ' 轮：' + (turn.title || '（空消息）'),
        'aria-current': isCurrent ? 'true' : undefined,
        onMouseEnter: () => setHoverIndex(i),
        onFocus: () => setHoverIndex(i),
        onClick: () => jumpTo(turn.key, i),
      }, line)
    })
    slotRefs.current.length = turns.length

    const hovered = hoverIndex >= 0 && hoverIndex < turns.length ? turns[hoverIndex] : null
    const cardEl = hovered
      ? React.createElement('div', { className: 'tnv-card', ref: cardRef, style: { visibility: 'hidden', left: 0, top: 0 } },
          React.createElement('div', { className: 'tnv-card-head' },
            React.createElement('span', { className: 'tnv-card-index' }, String(hoverIndex + 1)),
            React.createElement('span', { className: 'tnv-card-total' }, '/ ' + turns.length),
            hovered.size > 1
              ? React.createElement('span', { className: 'tnv-card-size' }, hovered.size + ' 步')
              : null,
          ),
          React.createElement('div', { className: 'tnv-card-title' },
            hovered.title || React.createElement('span', { className: 'tnv-card-placeholder' }, '（空消息）'),
          ),
          React.createElement('div', { className: 'tnv-card-reply' },
            hovered.reply || React.createElement('span', { className: 'tnv-card-placeholder' }, '（回复中…）'),
          ),
        )
      : null

    return React.createElement('div', {
      className: 'tnv' + (overflow ? ' tnv--overflow' : ''),
      ref: railRef,
      role: 'navigation',
      'aria-label': '对话轮次导航',
      style: { left: geom.left + 10, top: geom.top + 20, height: railHeight },
    },
      React.createElement('div', {
        className: 'tnv-track',
        ref: trackRef,
        onMouseMove: onTrackMove,
        onMouseLeave: () => {
          setHoverIndex(-1)
          pointerPeakRef.current = null
          paint(null)
        },
      }, slotEls),
      cardEl,
    )
  }

  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: 'turn-nav' },
    (props: any) => React.createElement(TurnNav, props),
  ))

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
    { name: 'sidebar.footer.action', id: 'turn-nav-toggle', order: TOGGLE_SLOT_ORDER },
    (props: any) => React.createElement(RailToggle, props),
  ))
}
