/**
 * Type surface of the platform modules this bundle imports. The shell resolves
 * them at runtime from its frozen module table (see tsdown.config.ts), so they
 * are externals with no package installed here for TypeScript to read — without
 * this declaration the import is an error even though the build is correct.
 *
 * Declared narrowly on purpose: what is written here is exactly this plugin's
 * dependency on the harness's client UI, so widening it is a deliberate act.
 * Kept in sync by hand with `packages/client/ui-primitives/src/icons/props.ts`
 * in the harness checkout.
 */
declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { ReactElement } from 'react'

  /** Shared props of every `ic_ds_*` icon: square edge in px, and a layout class; color rides currentColor. */
  export interface IconProps {
    size?: number | undefined
    className?: string | undefined
  }

  export const IconChevronDownOutline14: (props: IconProps) => ReactElement
}
