/**
 * Bocha web-search plugin, browser half: one card in Settings → Plugins.
 *
 * The tool itself is entirely host-side; this half exists only so the
 * configuration the Host resolves per search is editable without hand-editing
 * cordis.yml. The two halves pair through the settings namespace alone — the
 * configurable-plugins tab dispatches a card by the namespace its Host
 * counterpart registered, and never learns what either means.
 */

import * as React from 'react'
import { WEB_SEARCH_NAMESPACE } from '../namespace.ts'
import { createSettingsStore } from './settings-store.ts'
import { SettingsCard } from './SettingsCard.tsx'

export const inject = ['slots']

/*
 * Copied value for value from ui-settings-plugins' PluginCard.module.css and
 * fields.module.css so this card and the shipped ones read as one stack; the
 * harness hashes its class names per build and its card components sit outside
 * the shell's frozen module table, so a restyle upstream needs the same edit
 * here. (No backticks anywhere in this literal — they would end it.)
 */
const CSS = `
  .wbs-card {
    list-style: none;
    position: relative;
    border: 1px solid var(--dsw-alias-border-l2);
    border-radius: 12px;
    background: var(--dsw-alias-bg-layer-3);
    transition: border-color .16s, background .16s;
  }
  .wbs-card:hover {
    border-color: var(--dsw-alias-label-dimmed);
  }
  .wbs-card--open {
    background: var(--dsw-alias-bg-layer-2);
    border-color: var(--dsw-alias-label-dimmed);
  }
  /* Out-of-tree marker: the stripe separates this card while scanning the
     column, the pill in the header names the reason once you look. */
  .wbs-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 14px;
    bottom: 14px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 45%, transparent);
  }
  .wbs-header {
    width: 100%;
    appearance: none;
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 12px;
  }
  .wbs-header:focus-visible {
    outline: 2px solid var(--dsw-alias-brand-primary);
    outline-offset: -2px;
  }
  .wbs-headText {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .wbs-name {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--dsw-alias-label-primary);
  }
  .wbs-desc {
    font-size: 13px;
    line-height: 1.5;
    color: var(--dsw-alias-label-tertiary);
  }
  .wbs-pending {
    flex: none;
    border-radius: 999px;
    padding: 1px 8px;
    font-size: 11px;
    line-height: 17px;
    font-weight: 500;
    white-space: nowrap;
    background: var(--dsw-alias-bg-module-platform);
    color: var(--dsw-alias-label-secondary);
  }
  .wbs-badge {
    flex: none;
    border-radius: 999px;
    padding: 1px 8px;
    font-size: 11px;
    line-height: 17px;
    font-weight: 500;
    white-space: nowrap;
    background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 14%, transparent);
    color: var(--dsw-alias-state-business-primary);
  }
  .wbs-chevron {
    flex: none;
    color: var(--dsw-alias-label-tertiary);
    transition: transform .16s;
  }
  .wbs-chevron--open {
    transform: rotate(180deg);
  }
  .wbs-body {
    border-top: 1px solid var(--dsw-alias-border-l2);
    margin: 0 16px;
    padding-bottom: 8px;
  }
  .wbs-readOnly {
    margin: 12px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--dsw-alias-label-tertiary);
  }
  .wbs-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 0;
  }
  .wbs-field + .wbs-field {
    border-top: 1px solid var(--dsw-alias-border-l2);
  }
  .wbs-fieldHead {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .wbs-label {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.5;
    color: var(--dsw-alias-label-primary);
  }
  .wbs-hint {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--dsw-alias-label-tertiary);
  }
  .wbs-link {
    color: var(--dsw-alias-state-business-primary);
    text-decoration: none;
    white-space: nowrap;
  }
  .wbs-link:hover {
    text-decoration: underline;
  }
  .wbs-link:focus-visible {
    outline: 2px solid var(--dsw-alias-brand-primary);
    outline-offset: 2px;
    border-radius: 3px;
  }
  .wbs-reset {
    flex: none;
    border: none;
    background: none;
    padding: 0;
    font: inherit;
    font-size: 12px;
    line-height: 1.5;
    color: var(--dsw-alias-label-secondary);
    cursor: pointer;
  }
  .wbs-reset:hover:not(:disabled) {
    color: var(--dsw-alias-label-primary);
  }
  .wbs-reset:disabled {
    cursor: default;
    opacity: 0.5;
  }
  .wbs-input {
    width: 220px;
    max-width: 60%;
    height: 34px;
    padding: 0 12px;
    border: 1px solid var(--dsw-alias-border-l2);
    border-radius: 8px;
    background: var(--dsw-alias-bg-layer-3);
    color: var(--dsw-alias-label-primary);
    font: inherit;
    font-size: 13px;
  }
  .wbs-input:focus-visible {
    outline: 2px solid var(--dsw-alias-brand-primary);
    outline-offset: -1px;
  }
  .wbs-input--bad {
    border-color: var(--dsw-alias-label-error);
  }
  .wbs-input:disabled {
    opacity: 0.5;
  }
  .wbs-secretState {
    flex: none;
    font-size: 12px;
    line-height: 1.5;
    color: var(--dsw-alias-label-tertiary);
  }
  .wbs-secretActions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .wbs-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 0 4px;
    border-top: 1px solid var(--dsw-alias-border-l2);
  }
  .wbs-failed {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--dsw-alias-label-error);
  }
  .wbs-discard,
  .wbs-save {
    appearance: none;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 5px 14px;
    font: inherit;
    font-size: 13px;
    line-height: 1.5;
    cursor: pointer;
  }
  .wbs-discard {
    border-color: var(--dsw-alias-border-l2);
    background: none;
    color: var(--dsw-alias-label-secondary);
  }
  .wbs-discard:hover:not(:disabled) {
    color: var(--dsw-alias-label-primary);
    border-color: var(--dsw-alias-label-dimmed);
  }
  .wbs-save {
    background: var(--dsw-alias-label-primary);
    color: var(--dsw-alias-bg-layer-3);
  }
  .wbs-discard:disabled,
  .wbs-save:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .wbs-discard:focus-visible,
  .wbs-save:focus-visible {
    outline: 2px solid var(--dsw-alias-brand-primary);
    outline-offset: 1px;
  }

  @media (prefers-reduced-motion: reduce) {
    .wbs-chevron {
      transition: none;
    }
  }
`

/**
 * Client plugin body: own the injected stylesheet for the plugin's lifetime and
 * seat the card.
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

  const store = createSettingsStore()

  // Nested rather than declared in `inject` above: the tool is the plugin's
  // product and lives host-side, so a composition without a settings surface
  // still searches — it simply offers nothing to edit here.
  ctx.inject(['settingsScope', 'connection', 'remote'], (settingsCtx: any) => {
    settingsCtx.effect(
      () => store.attach(
        settingsCtx.settingsScope.bind({ namespace: WEB_SEARCH_NAMESPACE }),
        settingsCtx.get('connection').api,
      ),
      'web-search: configuration section',
    )
    // The key is not part of the section, so nothing in the settings scope
    // reports a change to it. The Host announces one here — and it announces
    // changes made from anywhere, including the Models page, which addresses
    // the same references, and a hand edit to the credentials document, which
    // its provider watches.
    settingsCtx.effect(
      () => settingsCtx.remote.$on('credentials/updated', () => { void store.refreshKey() }),
      'web-search: credential invalidations',
    )
  })

  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register(
    { name: 'settings.plugin.item', key: WEB_SEARCH_NAMESPACE },
    () => React.createElement(SettingsCard, { store }),
  ))
}
