/**
 * This plugin's card in Settings → Plugins.
 *
 * Structure and tokens mirror ui-settings-plugins' `PluginCard` and its field
 * rows so this card and the shipped ones read as one stack; they are copied
 * rather than imported, because the harness hashes its class names per build
 * and its card components sit outside the shell's frozen module table.
 *
 * Edits stage rather than apply per keystroke — these are text and numbers,
 * where writing on every key would store values the user never chose.
 *
 * The API key itself is NOT here. The section names a credential *reference*;
 * the value lives with the credential provider, which the shipped card reaches
 * through the credentials RPC domain. Whether a plugin outside the harness can
 * reach that domain is unverified, so this card edits the reference and leaves
 * the secret where it already is.
 */

import * as React from 'react'
import { IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import { COUNT_RANGE, DEFAULT_SETTINGS, type WebSearchSettings } from '../namespace.ts'
import type { WebSearchStore } from './settings-store.ts'

/** One editable row. */
interface FieldSpec {
  field: keyof WebSearchSettings
  label: string
  hint: string
  kind: 'text' | 'number' | 'boolean'
}

const FIELDS: readonly FieldSpec[] = [
  { field: 'endpoint', label: '接口地址', hint: '博查搜索 API 的 endpoint。', kind: 'text' },
  { field: 'apiKeyRef', label: '密钥引用名', hint: '凭据提供方里的名字，密钥本身不存在这里。', kind: 'text' },
  { field: 'defaultCount', label: '默认结果数', hint: `模型没指定 count 时用这个。${COUNT_RANGE.min}–${COUNT_RANGE.max}`, kind: 'number' },
  { field: 'defaultSummary', label: '默认返回摘要', hint: '模型没指定 summary 时用这个。', kind: 'boolean' },
]

/** Staged value per field; booleans stay booleans, the rest stage as text. */
type Draft = Record<keyof WebSearchSettings, string | boolean>

/** Project the committed section into editable form. */
function draftOf(value: WebSearchSettings): Draft {
  return {
    endpoint: value.endpoint,
    apiKeyRef: value.apiKeyRef,
    defaultCount: String(value.defaultCount),
    defaultSummary: value.defaultSummary,
  }
}

/**
 * Parse one staged field, or undefined when it cannot be saved — the card
 * offers no value the Host would reject.
 * @param spec - the row being parsed.
 * @param raw - the staged value.
 * @returns the value, or undefined when invalid.
 */
function parseField(spec: FieldSpec, raw: string | boolean): string | number | boolean | undefined {
  if (spec.kind === 'boolean') return typeof raw === 'boolean' ? raw : undefined
  if (typeof raw !== 'string') return undefined
  if (spec.kind === 'text') return raw.trim() === '' ? undefined : raw.trim()
  if (!/^\d+$/.test(raw.trim())) return undefined
  const parsed = Number(raw.trim())
  return parsed >= COUNT_RANGE.min && parsed <= COUNT_RANGE.max ? parsed : undefined
}

/**
 * Render the card.
 * @param props - the store the card reads and writes.
 * @returns the card, or nothing while the namespace is unavailable.
 */
export function SettingsCard({ store }: { store: WebSearchStore }): React.ReactElement | null {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(store.get)
  const [status, setStatus] = React.useState(store.status)
  const [overridden, setOverridden] = React.useState(store.overridden)
  const [draft, setDraft] = React.useState<Draft>(() => draftOf(store.get()))
  const [saving, setSaving] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const ids: Record<string, string> = {
    endpoint: React.useId(),
    apiKeyRef: React.useId(),
    defaultCount: React.useId(),
    defaultSummary: React.useId(),
  }

  /**
   * Adopt Host values into the staged draft only while nothing is staged: a
   * document edited elsewhere must not overwrite what the user is typing here.
   */
  const dirtyRef = React.useRef(false)
  React.useEffect(() => store.subscribe(() => {
    const next = store.get()
    setValue(next)
    setStatus(store.status())
    setOverridden(store.overridden())
    if (!dirtyRef.current) setDraft(draftOf(next))
  }), [store])

  const parsed = FIELDS.map(spec => parseField(spec, draft[spec.field]))
  const invalid = parsed.some(entry => entry === undefined)
  const dirty = FIELDS.some((spec, index) => parsed[index] !== value[spec.field])
  dirtyRef.current = dirty

  if (status.phase === 'unavailable') return null

  const save = (): void => {
    const patch: Partial<WebSearchSettings> = {}
    FIELDS.forEach((spec, index) => {
      const next = parsed[index]
      if (next !== undefined && next !== value[spec.field]) {
        Object.assign(patch, { [spec.field]: next })
      }
    })
    setSaving(true)
    setFailed(false)
    store.save(patch).then(
      () => { setSaving(false) },
      () => {
        setSaving(false)
        setFailed(true)
      },
    )
  }

  return (
    <li className={open ? 'wbs-card wbs-card--open' : 'wbs-card'}>
      <button
        type="button"
        className="wbs-header"
        aria-expanded={open}
        aria-label={`${open ? '收起' : '展开'}：博查搜索`}
        onClick={() => { setOpen(!open) }}
      >
        <span className="wbs-headText">
          <span className="wbs-name">博查搜索</span>
          <span className="wbs-desc">bocha_web_search 工具的接口与默认值。</span>
        </span>
        {dirty ? <span className="wbs-pending">未保存</span> : null}
        <span className="wbs-badge">自定义</span>
        <IconChevronDownOutline14 className={open ? 'wbs-chevron wbs-chevron--open' : 'wbs-chevron'} />
      </button>
      {open ? (
        <div className="wbs-body">
          {status.phase === 'ready' && !status.writable
            ? <p className="wbs-readOnly" role="status">配置文件当前不可写。</p>
            : null}
          {FIELDS.map((spec, index) => (
            <div className="wbs-field" key={spec.field}>
              <div className="wbs-fieldHead">
                <label className="wbs-label" htmlFor={ids[spec.field]}>{spec.label}</label>
                {/* Presence in the user layer, not a value comparison: an
                    override equal to the cordis.yml value is still an override,
                    and this button is what returns the field to that layer. */}
                {overridden.has(spec.field) ? (
                  <button
                    type="button"
                    className="wbs-reset"
                    disabled={!status.writable || saving}
                    title="改回 cordis.yml 里的值"
                    onClick={() => { void store.reset(spec.field) }}
                  >
                    恢复
                  </button>
                ) : null}
                {spec.kind === 'boolean' ? (
                  <input
                    id={ids[spec.field]}
                    type="checkbox"
                    checked={draft[spec.field] === true}
                    disabled={!status.writable}
                    onChange={(event) => { setDraft({ ...draft, [spec.field]: event.target.checked }) }}
                  />
                ) : (
                  <input
                    id={ids[spec.field]}
                    className={parsed[index] === undefined ? 'wbs-input wbs-input--bad' : 'wbs-input'}
                    type="text"
                    inputMode={spec.kind === 'number' ? 'numeric' : 'text'}
                    value={String(draft[spec.field])}
                    disabled={!status.writable}
                    aria-invalid={parsed[index] === undefined}
                    onChange={(event) => { setDraft({ ...draft, [spec.field]: event.target.value }) }}
                  />
                )}
              </div>
              <p className="wbs-hint">
                {spec.hint}
                {overridden.has(spec.field) ? null : ` 当前继承自 cordis.yml（${String(DEFAULT_SETTINGS[spec.field])} 为内置默认）。`}
              </p>
            </div>
          ))}
          <div className="wbs-footer">
            {failed ? <p className="wbs-failed" role="status">保存失败。</p> : null}
            <button
              type="button"
              className="wbs-discard"
              disabled={!dirty || saving}
              onClick={() => { setDraft(draftOf(value)); setFailed(false) }}
            >
              放弃
            </button>
            <button
              type="button"
              className="wbs-save"
              disabled={!dirty || invalid || saving || !status.writable}
              onClick={save}
            >
              {saving ? '保存中' : '保存'}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  )
}
