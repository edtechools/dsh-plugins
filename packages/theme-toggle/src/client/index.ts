/**
 * Theme toggle plugin, browser half: a compact light/dark switch in the sidebar
 * foot, beside Settings.
 *
 * The theme is read and written through the `theme` service the harness's
 * ui-theme plugin provides. Reaching another plugin through a cordis service
 * rather than importing its module is what keeps this bundle free of any
 * specifier the shell's frozen module table cannot answer; the one value import
 * here, the icon set, is itself a platform module and stays external.
 * `setTheme` is the product's own preference write path, so the switch persists
 * exactly like the Appearance row in Settings and both stay in sync.
 *
 * The product preference has three values (`light` / `dark` / `system`) while a
 * switch has two. This toggles against the *resolved* scheme rather than the
 * stored preference: whatever you are currently looking at, one click gives you
 * the other. A click therefore always leaves `system`, which the Appearance row
 * in Settings remains the way back to.
 */

import * as React from 'react'
// A platform module, so this stays an external the shell's frozen table answers
// — the icons are the product's own, drawn on its grid, not a second copy.
import { IconDarkOutline16, IconLightOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'

export const inject = ['slots', 'theme']

/** Slot order: the sidebar foot renders actions above Settings, this one first. */
const SLOT_ORDER = 10

/*
 * Mirrors the Settings trigger row (ui-settings-general `SettingsRoot.module.css`
 * `.trigger` / `.trigger.rail`) value for value, so the two rows in the sidebar
 * foot read as one control group. These are copied rather than inherited — the
 * harness's class names are hashed per build and cannot be targeted from here —
 * so a restyle upstream needs the same edit here.
 */
const CSS = `
  .tt-btn {
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
  .tt-btn:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
  .tt-btn:focus-visible {
    outline: 2px solid var(--dsw-alias-state-business-primary);
    outline-offset: -2px;
  }
  /* Rail trigger: the same 36x36 circle box as the other rail controls. */
  .tt-btn--rail {
    width: 36px;
    height: 36px;
    margin: 8px 0 10px;
    justify-content: center;
    gap: 0;
    padding: 0;
    border-radius: 50%;
  }
  .tt-btn svg {
    flex: none;
    width: 16px;
    height: 16px;
    display: block;
  }
  .tt-label {
    overflow: hidden;
    white-space: nowrap;
  }
`

/**
 * Client plugin body: own the injected stylesheet for the plugin's lifetime and
 * seat the switch in the sidebar foot.
 */
export function apply(ctx: any): void {
  const styleEl = document.createElement('style')
  styleEl.textContent = CSS
  document.head.appendChild(styleEl)
  ctx.effect(() => () => {
    styleEl.remove()
  })

  /** The switch (created once per activation, so hook state is stable). */
  function ThemeToggle(props: any): React.ReactElement {
    const [snapshot, setSnapshot] = React.useState<any>(() => ctx.theme.getTheme())
    // The service is the single source of truth: a change from the Appearance
    // row in Settings reaches this switch through the same event.
    React.useEffect(() => ctx.on('theme/change', (next: any) => setSnapshot(next)), [])

    const isDark = snapshot.active.colorScheme === 'dark'
    const wide = props.wide !== false
    // Icon and label both name the destination, so the row reads as the action
    // it performs — the same way the Settings row beside it names where it goes.
    const label = isDark ? '浅色模式' : '深色模式'
    const action = isDark ? '切换到浅色模式' : '切换到深色模式'
    return React.createElement('button', {
      type: 'button',
      className: 'tt-btn' + (wide ? '' : ' tt-btn--rail'),
      title: action,
      'aria-label': action,
      onClick: () => ctx.theme.setTheme(isDark ? 'light' : 'dark'),
    },
      React.createElement(isDark ? IconLightOutline16 : IconDarkOutline16, { size: 16 }),
      wide ? React.createElement('span', { className: 'tt-label' }, label) : null,
    )
  }

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
    { name: 'sidebar.footer.action', id: 'theme-toggle', order: SLOT_ORDER },
    (props: any) => React.createElement(ThemeToggle, props),
  ))
}
