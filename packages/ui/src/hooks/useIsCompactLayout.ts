import { useMediaQuery } from './useMediaQuery';

// Exact complement of Tailwind's `sm` breakpoint (min-width: 640px), so this
// hook and the `max-sm:` utilities always agree on what "phone-sized" means.
// The desktop window can't go below 660px (tauri.conf.json minWidth), so this
// only ever matches on a phone.
export const COMPACT_LAYOUT_QUERY = '(max-width: 639.98px)';

export const useIsCompactLayout = (): boolean =>
  useMediaQuery(COMPACT_LAYOUT_QUERY);
