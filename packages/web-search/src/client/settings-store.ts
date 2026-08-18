/**
 * This plugin's configuration, mirrored locally over the durable settings
 * section.
 *
 * A local mirror rather than reads straight off the scope: the card renders
 * synchronously and the scope's first value arrives asynchronously, so the
 * mirror is what lets the card mount at the defaults and adopt the stored
 * section when it lands.
 *
 * The API key is NOT held in this section. The card addresses it through the
 * credentials domain by the reference the section names — `credentials.set`
 * writes it, `credentials.unset` clears it, and `credentials.describe` reports
 * whether one is configured. So the store reads only booleans about the key,
 * never the literal — exactly the split the shipped model cards' key uses, and
 * the reason `llm-deepseek` declares only `apiKeyEnv`.
 *
 * Deliberately not shared with the sibling plugins that carry a near-identical
 * store: a package here is installable on its own from a repository
 * subdirectory, where a workspace dependency would not resolve.
 */

import { DEFAULT_CONFIG, WEB_SEARCH_NAMESPACE, type WebSearchConfig } from '../namespace.ts'

/** What the durable section can currently do. */
export interface SectionStatus {
  phase: 'loading' | 'ready' | 'unavailable'
  writable: boolean
}

/** Fields the browser can both read and write; the key is neither. */
export type ReadableField = 'endpoint' | 'apiKeyRef' | 'defaultCount' | 'defaultSummary' | 'timeoutMs'

/** What the credentials domain last reported about the referenced key. */
export interface CredentialState {
  /** Reference this answer describes; a stale response for another one is dropped. */
  ref: string
  /** Whether any layer supplies a value for it. undefined until the domain answers. */
  configured: boolean | undefined
  /** Whether `credentials.set`/`credentials.unset` can affect it; undefined until the domain answers. */
  writable: boolean | undefined
  /**
   * Which layer supplies the value, when one does. Kept because it is the only
   * thing that explains an unwritable key: the process environment is the one
   * layer this process cannot edit, and a control disabled without saying so
   * reads as broken rather than as inherited.
   */
  source: string | undefined
}

/** The configuration, plus which fields the user has overridden. */
export interface WebSearchStore {
  get: () => WebSearchConfig
  status: () => SectionStatus
  /**
   * Fields present in the stored user layer. PRESENCE is what marks an
   * override — a stored value equal to the composition base is still an
   * override, and comparing values could not see it.
   */
  overridden: () => ReadonlySet<keyof WebSearchConfig>
  subscribe: (listener: () => void) => () => void
  /** Commit staged edits; only changed fields are written. */
  save: (patch: Partial<WebSearchConfig>) => Promise<void>
  /** Drop one field's override so it re-inherits the cordis.yml base. */
  reset: (field: keyof WebSearchConfig) => Promise<void>
  /**
   * Whether the Host reports a credential configured for the section's
   * reference; undefined until the credentials domain has answered. The value
   * itself is unreadable by construction, so this is the only thing a card can
   * honestly show about it.
   */
  keyConfigured: () => boolean | undefined
  /**
   * Whether `credentials.set`/`credentials.unset` can affect the section's
   * reference; undefined until the credentials domain has answered. An unknown
   * answer is treated as writable so the control stays usable and the Host is
   * what refuses — never the card.
   */
  keyWritable: () => boolean | undefined
  /** Which layer supplies the key ('env', 'file', a dotenv layer); undefined when none does. */
  keySource: () => string | undefined
  /**
   * Re-read the credentials domain. Called on the Host's own
   * `credentials/updated` notification, so a key stored from another surface —
   * the Models page addresses the same references — is reflected here without
   * anything in this plugin's section changing.
   */
  refreshKey: () => Promise<void>
  /**
   * Store a literal API key under the section's reference, or clear the stored
   * one with an empty string (which routes to `credentials.unset`). The value
   * never touches the settings document.
   */
  writeKey: (value: string) => Promise<void>
  /**
   * Bind the durable section; returns the unbind disposer.
   * @param scope - the bound settings scope.
   * @param api - the RPC face, used to reach the credentials domain for the
   * one fact the scope does not carry (see {@link WebSearchStore.keyConfigured}).
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

/** Build the store. Starts at the schema defaults and unattached. */
export function createSettingsStore(): WebSearchStore {
  const listeners = new Set<() => void>()
  let value: WebSearchConfig = { ...DEFAULT_CONFIG }
  let status: SectionStatus = UNAVAILABLE
  let overridden: ReadonlySet<keyof WebSearchConfig> = new Set()
  let credential: CredentialState = { ref: '', configured: undefined, writable: undefined, source: undefined }
  let scope: any
  let api: any
  const notify = (): void => {
    for (const listener of listeners) listener()
  }

  /** The credential reference the section currently names. */
  const refOf = (): string => value.apiKeyRef

  /**
   * Ask the credentials domain about the reference the section currently names.
   *
   * The answer is stored with the reference it describes: `apiKeyRef` can
   * change between the request and its response, and two reads can settle out
   * of order, so a response is published only while it still answers for the
   * reference in force.
   */
  const refreshKey = async (): Promise<void> => {
    if (api === undefined) return
    const ref = refOf()
    if (ref !== credential.ref) {
      // A new reference knows nothing yet; keeping the old answer would claim
      // the key is configured under a name nobody has checked.
      const wasKnown = credential.configured !== undefined || credential.writable !== undefined
      credential = { ref, configured: undefined, writable: undefined, source: undefined }
      if (wasKnown) notify()
    }
    let response: any
    try {
      response = await api.credentials.describe({ refs: [ref] })
    } catch (_credentialReadFailure) {
      // The card stays usable without this: the key control simply reports the
      // last state it knew, and a write still reaches the Host.
      return
    }
    if (response?.result?.ok !== true || ref !== refOf()) return
    const view = response.result.value.credentials[ref]
    const next: CredentialState = {
      ref,
      configured: view?.configured ?? false,
      // An unknown reference is treated as writable: the control stays usable
      // and the Host is what refuses, rather than the card guessing a refusal.
      writable: view?.writable ?? true,
      source: typeof view?.source === 'string' ? view.source : undefined,
    }
    if (next.configured === credential.configured
      && next.writable === credential.writable
      && next.source === credential.source) return
    credential = next
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
        if (next === value[field as keyof WebSearchConfig]) continue
        // Sequential rather than parallel: the scope fences each write with the
        // revision it last saw, and concurrent writes would race that fence.
        await scope.set(field, next)
      }
    },
    reset: async (field) => {
      if (scope === undefined) return
      await scope.clear(field)
    },
    keyConfigured: () => credential.configured,
    keyWritable: () => credential.writable,
    keySource: () => credential.source,
    refreshKey: () => refreshKey(),
    writeKey: async (next) => {
      if (api === undefined) return
      const ref = refOf()
      try {
        // Empty clears rather than stores a blank; `credentials.set` would reject
        // one anyway. Clearing routes to `credentials.unset`, which is the only
        // way to remove the value from the credential plane.
        if (next === '') await api.credentials.unset({ ref })
        else await api.credentials.set({ ref, value: next })
      } catch (_credentialWriteFailure) {
        // Refusals surface through the re-read below: the Host is the only
        // authority on whether the key now exists.
      }
      await refreshKey()
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
        const nextValue: WebSearchConfig = section === undefined
          ? value
          : {
            endpoint: pick(section.endpoint, value.endpoint),
            apiKeyRef: pick(section.apiKeyRef, value.apiKeyRef),
            defaultCount: pick(section.defaultCount, value.defaultCount),
            defaultSummary: pick(section.defaultSummary, value.defaultSummary),
            timeoutMs: pick(section.timeoutMs, value.timeoutMs),
          }
        const user: unknown = snapshot.user
        const nextOverridden = new Set<keyof WebSearchConfig>(
          user === null || typeof user !== 'object'
            ? []
            : (Object.keys(user) as (keyof WebSearchConfig)[])
              .filter(field => field in DEFAULT_CONFIG),
        )
        const changed = (Object.keys(DEFAULT_CONFIG) as (keyof WebSearchConfig)[])
          .some(field => nextValue[field] !== value[field])
          || nextStatus.phase !== status.phase
          || nextStatus.writable !== status.writable
          || nextOverridden.size !== overridden.size
          || [...nextOverridden].some(field => !overridden.has(field))
        if (changed) {
          value = nextValue
          status = nextStatus
          overridden = nextOverridden
          notify()
        }
        // Only when the reference moves. A credential changed from elsewhere
        // arrives through the Host's `credentials/updated` notification
        // instead, so probing on every unrelated section change would be one
        // wire call per keystroke-sized edit for an answer that cannot have
        // changed.
        if (credential.ref !== value.apiKeyRef) void refreshKey()
      }
      sync()
      const off = bound.subscribe(sync)
      return () => {
        off()
        scope = undefined
        api = undefined
        credential = { ref: '', configured: undefined, writable: undefined, source: undefined }
        status = UNAVAILABLE
        notify()
      }
    },
  }
}
