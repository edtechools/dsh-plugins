/**
 * This plugin's configuration, mirrored locally over the durable settings
 * section.
 *
 * A local mirror rather than reads straight off the scope: the card renders
 * synchronously and the scope's first value arrives asynchronously, so the
 * mirror is what lets the card mount at the defaults and adopt the stored
 * section when it lands.
 *
 * Deliberately not shared with the sibling plugins that carry a near-identical
 * store: a package here is installable on its own from a repository
 * subdirectory, where a workspace dependency would not resolve.
 */

import { DEFAULT_SETTINGS, type WebSearchSettings } from '../namespace.ts'

/** What the durable section can currently do. */
export interface SectionStatus {
  phase: 'loading' | 'ready' | 'unavailable'
  writable: boolean
}

/** The configuration, plus which fields the user has overridden. */
export interface WebSearchStore {
  get: () => WebSearchSettings
  status: () => SectionStatus
  /**
   * Fields present in the stored user layer. PRESENCE is what marks an
   * override — a stored value equal to the composition base is still an
   * override, and comparing values could not see it.
   */
  overridden: () => ReadonlySet<keyof WebSearchSettings>
  subscribe: (listener: () => void) => () => void
  /** Commit staged edits; only changed fields are written. */
  save: (patch: Partial<WebSearchSettings>) => Promise<void>
  /** Drop one field's override so it re-inherits the cordis.yml base. */
  reset: (field: keyof WebSearchSettings) => Promise<void>
  /** Bind the durable section; returns the unbind disposer. */
  attach: (scope: any) => () => void
}

const UNAVAILABLE: SectionStatus = { phase: 'unavailable', writable: false }

/**
 * Narrow one field off a wire section, keeping the last good value when the
 * Host does not carry it or carries something else.
 *
 * Version skew is an ORDINARY state here rather than an edge: the browser
 * bundle updates on a page refresh while the Host's registered schema updates
 * only on a restart, so a field this build knows about is routinely missing
 * from the Host that answers it.
 * @param raw - the field as the Host sent it.
 * @param fallback - the value to keep.
 * @returns the field, or the fallback.
 */
function pick<T>(raw: unknown, fallback: T): T {
  return typeof raw === typeof fallback ? raw as T : fallback
}

/** Build the store. Starts at the schema defaults and unattached. */
export function createSettingsStore(): WebSearchStore {
  const listeners = new Set<() => void>()
  let value: WebSearchSettings = { ...DEFAULT_SETTINGS }
  let status: SectionStatus = UNAVAILABLE
  let overridden: ReadonlySet<keyof WebSearchSettings> = new Set()
  let scope: any
  const notify = (): void => {
    for (const listener of listeners) listener()
  }
  return {
    get: () => value,
    status: () => status,
    overridden: () => overridden,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    save: async (patch) => {
      if (scope === undefined) return
      for (const [field, next] of Object.entries(patch)) {
        if (next === value[field as keyof WebSearchSettings]) continue
        // Sequential rather than parallel: the scope fences each write with the
        // revision it last saw, and concurrent writes would race that fence.
        await scope.set(field, next)
      }
    },
    reset: async (field) => {
      if (scope === undefined) return
      await scope.clear(field)
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
        const nextValue: WebSearchSettings = section === undefined
          ? value
          : {
            endpoint: pick(section.endpoint, value.endpoint),
            apiKeyRef: pick(section.apiKeyRef, value.apiKeyRef),
            defaultCount: pick(section.defaultCount, value.defaultCount),
            defaultSummary: pick(section.defaultSummary, value.defaultSummary),
          }
        const user: unknown = snapshot.user
        const nextOverridden = new Set<keyof WebSearchSettings>(
          user === null || typeof user !== 'object'
            ? []
            : (Object.keys(user) as (keyof WebSearchSettings)[])
              .filter(field => field in DEFAULT_SETTINGS),
        )
        const changed = (Object.keys(DEFAULT_SETTINGS) as (keyof WebSearchSettings)[])
          .some(field => nextValue[field] !== value[field])
          || nextStatus.phase !== status.phase
          || nextStatus.writable !== status.writable
          || nextOverridden.size !== overridden.size
          || [...nextOverridden].some(field => !overridden.has(field))
        if (!changed) return
        value = nextValue
        status = nextStatus
        overridden = nextOverridden
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
