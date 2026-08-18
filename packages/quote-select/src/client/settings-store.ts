/**
 * This plugin's limits, mirrored locally over the durable settings section.
 *
 * A local mirror rather than reads straight off the scope: the quoting surfaces
 * render synchronously and the scope's first value arrives asynchronously, so
 * the mirror is what lets activation proceed at the schema defaults and adopt
 * the stored values when they land. Without a settings provider composed the
 * mirror is never attached, and the defaults are simply what the plugin uses.
 *
 * Deliberately not shared with the sibling plugins that carry a near-identical
 * store: a package here is installable on its own from a repository
 * subdirectory, where a workspace dependency would not resolve.
 */

import { DEFAULT_SETTINGS, type QuoteSelectSettings } from '../namespace.ts'

/**
 * What the durable section can currently do. Separate from the value because
 * the card renders three different things from it: nothing at all while the
 * namespace is unavailable, a read-only notice once a section has landed on a
 * document that refuses writes, and inert controls until either is known.
 */
export interface SectionStatus {
  phase: 'loading' | 'ready' | 'unavailable'
  writable: boolean
}

/** The limits, shared by the quoting surfaces and the settings card. */
export interface QuoteSelectStore {
  get: () => QuoteSelectSettings
  status: () => SectionStatus
  subscribe: (listener: () => void) => () => void
  /**
   * Commit staged edits. Only changed fields are written, each through the
   * scope's own queue, so a save carries no field the user did not touch.
   * @param patch - the staged values.
   * @returns settlement after the last write.
   */
  save: (patch: Partial<QuoteSelectSettings>) => Promise<void>
  /** Bind the durable section; returns the unbind disposer. */
  attach: (scope: any) => () => void
}

const UNAVAILABLE: SectionStatus = { phase: 'unavailable', writable: false }

/**
 * Narrow one numeric field off a wire section, keeping the last good value when
 * the Host does not carry it or carries something else.
 *
 * Version skew is an ORDINARY state here rather than an edge: the browser
 * bundle updates on a page refresh while the Host's registered schema updates
 * only on a restart, so a field this build knows about is routinely missing
 * from the Host that answers it. Copying the section wholesale would put
 * `undefined` straight into the limits every quoting surface reads.
 * @param raw - the field as the Host sent it.
 * @param fallback - the value to keep.
 * @returns the field, or the fallback.
 */
function pickNumber(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback
}

/** Build the store. Starts at the schema defaults and unattached. */
export function createSettingsStore(): QuoteSelectStore {
  const listeners = new Set<() => void>()
  let value: QuoteSelectSettings = { ...DEFAULT_SETTINGS }
  // Unattached is indistinguishable from unavailable to every consumer: with
  // no settings provider composed there is no section to show or write.
  let status: SectionStatus = UNAVAILABLE
  let scope: any
  const notify = (): void => {
    for (const listener of listeners) listener()
  }
  return {
    get: () => value,
    status: () => status,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    save: async (patch) => {
      if (scope === undefined) return
      for (const [field, next] of Object.entries(patch)) {
        if (next === value[field as keyof QuoteSelectSettings]) continue
        // Sequential rather than parallel: the scope fences each write with the
        // revision it last saw, and three concurrent writes would race that
        // fence into two spurious rejections.
        await scope.set(field, next)
      }
    },
    attach: (bound) => {
      scope = bound
      const sync = (): void => {
        const snapshot = bound.getSnapshot()
        const section = snapshot.value
        const nextStatus: SectionStatus = {
          phase: snapshot.status,
          writable: snapshot.writable === true && snapshot.status === 'ready',
        }
        // Field by field, each with a fallback (see pickNumber): a section the
        // Host has not answered for yet is the easy case, version skew is the
        // one that matters.
        const nextValue: QuoteSelectSettings = section === undefined
          ? value
          : {
            maxQuoteLength: pickNumber(section.maxQuoteLength, value.maxQuoteLength),
            maxCommentLength: pickNumber(section.maxCommentLength, value.maxCommentLength),
            maxQuotes: pickNumber(section.maxQuotes, value.maxQuotes),
          }
        const changed = nextValue.maxQuoteLength !== value.maxQuoteLength
          || nextValue.maxCommentLength !== value.maxCommentLength
          || nextValue.maxQuotes !== value.maxQuotes
          || nextStatus.phase !== status.phase
          || nextStatus.writable !== status.writable
        if (!changed) return
        value = nextValue
        status = nextStatus
        notify()
      }
      sync()
      const off = bound.subscribe(sync)
      return () => {
        off()
        scope = undefined
        status = UNAVAILABLE
        notify()
      }
    },
  }
}
