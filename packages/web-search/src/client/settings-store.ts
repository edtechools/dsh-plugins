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

import { DEFAULT_SETTINGS, WEB_SEARCH_NAMESPACE, type WebSearchSettings } from '../namespace.ts'

/** What the durable section can currently do. */
export interface SectionStatus {
  phase: 'loading' | 'ready' | 'unavailable'
  writable: boolean
}

/** Fields the browser can both read and write; the secret is neither. */
export type ReadableField = 'endpoint' | 'apiKeyRef' | 'defaultCount' | 'defaultSummary'

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
  /**
   * Whether a literal API key is stored; undefined until the Host has said.
   * The value itself is unreadable by construction, so this is the only thing
   * a card can honestly show about it.
   */
  secretSet: () => boolean | undefined
  /** Store a literal API key, or clear the stored one with an empty string. */
  writeSecret: (value: string) => Promise<void>
  /**
   * Bind the durable section; returns the unbind disposer.
   * @param scope - the bound settings scope.
   * @param api - the RPC face, for the one fact the scope does not carry
   * (see {@link WebSearchStore.secretSet}).
   */
  attach: (scope: any, api: any) => () => void
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

/** The write-only field's name, in one place because three call sites address it by path. */
const SECRET_FIELD = 'apiKey'

/** Build the store. Starts at the schema defaults and unattached. */
export function createSettingsStore(): WebSearchStore {
  const listeners = new Set<() => void>()
  let value: WebSearchSettings = { ...DEFAULT_SETTINGS }
  let status: SectionStatus = UNAVAILABLE
  let overridden: ReadonlySet<keyof WebSearchSettings> = new Set()
  let secretSet: boolean | undefined
  let scope: any
  let api: any
  const notify = (): void => {
    for (const listener of listeners) listener()
  }

  /**
   * Ask the Host whether a literal key stands. The bound scope cannot answer:
   * it drops the descriptor's `secrets` list, and the secret is stripped from
   * the `user` layer it does keep, so nothing in a snapshot distinguishes
   * "no key" from "a key the wire refuses to send".
   */
  const refreshSecret = async (): Promise<void> => {
    if (api === undefined) return
    let next: boolean | undefined
    try {
      const response = await api.settings.describe({})
      const view = response?.result?.ok === true
        ? response.result.value.namespaces.find((n: any) => n.ns === WEB_SEARCH_NAMESPACE)
        : undefined
      const slot = view?.secrets?.find((entry: any) => entry.path?.[0] === SECRET_FIELD)
      next = slot?.set === true
    } catch (_settingsDescribeFailure) {
      // Unknown rather than false: claiming "no key" on a failed read would
      // invite the user to paste one they already have.
      next = undefined
    }
    if (next === secretSet) return
    secretSet = next
    notify()
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
    secretSet: () => secretSet,
    writeSecret: async (next) => {
      if (scope === undefined) return
      // Empty clears rather than storing a blank: an empty secret would read
      // as "configured" to every surface that can only see whether one stands.
      if (next === '') await scope.clear(SECRET_FIELD)
      else await scope.set(SECRET_FIELD, next)
      await refreshSecret()
    },
    attach: (bound, boundApi) => {
      scope = bound
      api = boundApi
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
      void refreshSecret()
      const off = bound.subscribe(sync)
      return () => {
        off()
        scope = undefined
        api = undefined
        secretSet = undefined
        status = UNAVAILABLE
        notify()
      }
    },
  }
}
