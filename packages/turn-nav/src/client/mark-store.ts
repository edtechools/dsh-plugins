/**
 * Turn marks: which turns of a conversation the user flagged as worth finding
 * again, kept per session and keyed by chat-node key.
 *
 * Browser-local on purpose, unlike this plugin's two preferences. Those are one
 * boolean each and belong in the settings document; marks are per-session data
 * that grows with every conversation, and that document is one the user opens
 * in a text editor (Settings has an "open configuration file" button) — filling
 * it with machine-generated `{sessionId: [nodeKey…]}` maps would make it
 * unreadable. The Host offers no per-session annotation store to write to
 * instead, so the cost of this choice is real and named: marks do not follow
 * the user to another browser or machine.
 *
 * Growth is bounded by pruning against the live session list rather than by a
 * cap: a mark outlives the session it belongs to only until the next prune.
 */

/** Storage key. Namespaced by package so a sibling plugin cannot collide. */
const STORAGE_KEY = 'dsh-plugin-turn-nav.marks'

/** Marks by session id, each an array of chat-node keys (arrays, so JSON round-trips). */
type MarkDocument = Record<string, string[]>

/** The mark set, shared by the rail and its labels. */
export interface MarkStore {
  /** Marked node keys for one session; empty when none. */
  get: (sessionId: string) => ReadonlySet<string>
  /** Flip one turn's mark and persist. */
  toggle: (sessionId: string, nodeKey: string) => void
  subscribe: (listener: () => void) => () => void
  /**
   * Drop marks for sessions that no longer exist.
   * @param live - ids currently in the session list.
   */
  prune: (live: Iterable<string>) => void
}

/** Read the document, treating any unreadable or malformed state as empty. */
function read(): MarkDocument {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // Storage unreachable (private mode, blocked site data). Marks are a
    // reading aid, so the session simply starts with none.
    return {}
  }
  if (raw === null) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const document: MarkDocument = {}
    for (const [sessionId, keys] of Object.entries(parsed)) {
      // A hand-edited or version-skewed entry is dropped rather than trusted:
      // this is a parse boundary, and the alternative is a crash on render.
      if (Array.isArray(keys)) document[sessionId] = keys.filter(key => typeof key === 'string')
    }
    return document
  } catch {
    // Not JSON at all — same answer as unreachable storage.
    return {}
  }
}

/** Build the store, restoring what the browser holds. */
export function createMarkStore(): MarkStore {
  const listeners = new Set<() => void>()
  let document = read()
  const notify = (): void => {
    for (const listener of listeners) listener()
  }
  const persist = (): void => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(document))
    } catch {
      // Same unreachable storage; the marks still apply for this session.
    }
  }
  return {
    get: (sessionId) => new Set(document[sessionId] ?? []),
    toggle: (sessionId, nodeKey) => {
      const current = document[sessionId] ?? []
      const next = current.includes(nodeKey)
        ? current.filter(key => key !== nodeKey)
        : [...current, nodeKey]
      // An empty set leaves no entry, so pruning is not the only thing that
      // keeps the document from accumulating sessions the user cleared by hand.
      if (next.length === 0) {
        const { [sessionId]: _cleared, ...rest } = document
        document = rest
      } else {
        document = { ...document, [sessionId]: next }
      }
      persist()
      notify()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    prune: (live) => {
      const keep = new Set(live)
      const next: MarkDocument = {}
      let dropped = false
      for (const [sessionId, keys] of Object.entries(document)) {
        if (keep.has(sessionId)) next[sessionId] = keys
        else dropped = true
      }
      if (!dropped) return
      document = next
      persist()
      notify()
    },
  }
}
