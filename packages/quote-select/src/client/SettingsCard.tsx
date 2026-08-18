/**
 * This plugin's card in Settings → Plugins.
 *
 * Structure and tokens mirror ui-settings-plugins' `PluginCard` and its field
 * rows (a list item whose header discloses the controls in place, with the save
 * that writes them) so this card and the shipped ones read as one stack. They
 * are copied rather than imported: the harness hashes its class names per build
 * and its card components sit outside the shell's frozen module table, so a
 * restyle upstream needs the same edit here.
 *
 * Edits stage rather than apply per keystroke, matching the shipped cards for
 * the reason they do it — these are numbers, and writing "6" on the way to
 * "600" would store a value the user never chose. The sibling turn-nav card
 * applies immediately because a switch has no intermediate states.
 */

import * as React from 'react'
import { IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import { LIMITS, type QuoteSelectSettings } from '../namespace.ts'
import type { QuoteSelectStore } from './settings-store.ts'

/** One editable row: its field, its label, and the note under it. */
interface FieldSpec {
  field: keyof QuoteSelectSettings
  label: string
  hint: string
}

const FIELDS: readonly FieldSpec[] = [
  { field: 'maxQuoteLength', label: '单条引用上限', hint: '超出后截断并接省略号。' },
  { field: 'maxCommentLength', label: '单条评论上限', hint: '同时是评论输入框的 maxLength。' },
  { field: 'maxQuotes', label: '每条消息的引用条数', hint: '到顶后药丸拒绝，而不是悄悄丢掉一条。' },
]

/** Staged text for every field, keyed by field name. */
type Draft = Record<keyof QuoteSelectSettings, string>

/** Project the committed section into editable text. */
function draftOf(value: QuoteSelectSettings): Draft {
  return {
    maxQuoteLength: String(value.maxQuoteLength),
    maxCommentLength: String(value.maxCommentLength),
    maxQuotes: String(value.maxQuotes),
  }
}

/**
 * Parse one staged field, or undefined when it is not a whole number inside
 * the schema's own range — the card offers no value the Host would reject.
 * @param field - which limit is being parsed.
 * @param raw - the staged text.
 * @returns the value, or undefined when it cannot be saved.
 */
function parseField(field: keyof QuoteSelectSettings, raw: string): number | undefined {
  if (!/^\d+$/.test(raw.trim())) return undefined
  const parsed = Number(raw.trim())
  const range = LIMITS[field]
  return parsed >= range.min && parsed <= range.max ? parsed : undefined
}

/**
 * Render the card.
 * @param props - the store the card reads and writes.
 * @returns the card, or nothing while the namespace is unavailable.
 */
export function SettingsCard({ store }: { store: QuoteSelectStore }): React.ReactElement | null {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(store.get)
  const [status, setStatus] = React.useState(store.status)
  const [draft, setDraft] = React.useState<Draft>(() => draftOf(store.get()))
  const [saving, setSaving] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const ids = { maxQuoteLength: React.useId(), maxCommentLength: React.useId(), maxQuotes: React.useId() }

  /**
   * Adopt Host values into the staged draft only while nothing is staged: a
   * document edited elsewhere must not overwrite what the user is typing here.
   */
  const dirtyRef = React.useRef(false)
  React.useEffect(() => store.subscribe(() => {
    const next = store.get()
    setValue(next)
    setStatus(store.status())
    if (!dirtyRef.current) setDraft(draftOf(next))
  }), [store])

  const parsed = FIELDS.map(spec => parseField(spec.field, draft[spec.field]))
  const invalid = parsed.some(entry => entry === undefined)
  const dirty = FIELDS.some((spec, index) => parsed[index] !== value[spec.field])
  dirtyRef.current = dirty

  // A deployment that does not serve this section shows no trace of it, rather
  // than a disabled card the user cannot act on (PluginCard's rule).
  if (status.phase === 'unavailable') return null

  const discard = (): void => {
    setDraft(draftOf(value))
    setFailed(false)
  }

  const save = (): void => {
    const patch: Partial<QuoteSelectSettings> = {}
    FIELDS.forEach((spec, index) => {
      const next = parsed[index]
      if (next !== undefined && next !== value[spec.field]) patch[spec.field] = next
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
    <li className={open ? 'qsl-set-card qsl-set-card--open' : 'qsl-set-card'}>
      <button
        type="button"
        className="qsl-set-header"
        aria-expanded={open}
        aria-label={`${open ? '收起' : '展开'}：划词引用`}
        onClick={() => { setOpen(!open) }}
      >
        <span className="qsl-set-headText">
          <span className="qsl-set-name">划词引用</span>
          <span className="qsl-set-desc">选中消息文本，引用进输入框。</span>
        </span>
        {dirty ? <span className="qsl-set-pending">未保存</span> : null}
        <span className="qsl-set-badge">自定义</span>
        <IconChevronDownOutline14
          className={open ? 'qsl-set-chevron qsl-set-chevron--open' : 'qsl-set-chevron'}
        />
      </button>
      {open ? (
        <div className="qsl-set-body">
          {status.phase === 'ready' && !status.writable
            ? <p className="qsl-set-readOnly" role="status">配置文件当前不可写。</p>
            : null}
          {FIELDS.map((spec, index) => (
            <div className="qsl-set-field" key={spec.field}>
              <div className="qsl-set-fieldHead">
                <label className="qsl-set-label" htmlFor={ids[spec.field]}>{spec.label}</label>
                <input
                  id={ids[spec.field]}
                  className={parsed[index] === undefined ? 'qsl-set-input qsl-set-input--bad' : 'qsl-set-input'}
                  type="text"
                  inputMode="numeric"
                  value={draft[spec.field]}
                  disabled={!status.writable}
                  aria-invalid={parsed[index] === undefined}
                  onChange={(event) => { setDraft({ ...draft, [spec.field]: event.target.value }) }}
                />
              </div>
              <p className="qsl-set-hint">
                {spec.hint}
                {' '}
                {LIMITS[spec.field].min}–{LIMITS[spec.field].max}
              </p>
            </div>
          ))}
          <div className="qsl-set-footer">
            {failed ? <p className="qsl-set-failed" role="status">保存失败。</p> : null}
            <button
              type="button"
              className="qsl-set-discard"
              disabled={!dirty || saving}
              onClick={discard}
            >
              放弃
            </button>
            <button
              type="button"
              className="qsl-set-save"
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
