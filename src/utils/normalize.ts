import { pick } from '@tdio/utils'

export type PopoverPlacement = 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end' | 'right' | 'right-start' | 'right-end'

// @ref element-ui/types/tooltip.d.ts
export interface TooltipOptions {
  /** Display content, can be overridden by slot#content */
  content: string;

  /** Position of Tooltip */
  placement: PopoverPlacement;

  /** Whether Tooltip is disabled */
  disabled: boolean;

  /** Offset of the Tooltip */
  offset: number;

  /** Animation name */
  transition: string;

  /** Whether an arrow is displayed. For more information, check Vue-popper page */
  visibleArrow: boolean;

  /** Popper.js parameters */
  popperOptions: object;

  /** Delay of appearance, in millisecond */
  openDelay: number;

  /** Whether to control Tooltip manually. mouseenter and mouseleave won't have effects if set to true */
  manual: boolean;

  /** Custom class name for Tooltip's popper */
  popperClass: string;

  /** Whether the mouse can enter the tooltip	 */
  enterable: string;

  /** Timeout in milliseconds to hide tooltip */
  hideAfter: string;

  /** Tooltip tabindex */
  tabindex: number;
}

const cleanup = <T extends Kv> (o: T): Partial<T> => Object.keys(o).reduce((r, k) => {
  if (o[k] != null) {
    r[k] = o[k]
  }
  return r
}, {} as T)

export const extractTooltip = (props: Kv): Partial<TooltipOptions> => {
  let tooltip: Partial<TooltipOptions> = props.tooltip || {}

  if (typeof tooltip === 'string') {
    tooltip = { content: tooltip }
  } else {
    if (typeof tooltip !== 'object') {
      tooltip = {}
    }
  }

  tooltip = {
    placement: 'top',
    ...tooltip,
    ...cleanup(pick(props, ['tooltipClass', 'popperClass', 'placement']))
  }

  return tooltip
}
