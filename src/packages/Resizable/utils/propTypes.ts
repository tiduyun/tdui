// @flow
import {DraggableCore, DraggableCoreProps} from '@/packages/Draggable'
import { VNode } from 'vue'
import { Component, Prop, Vue } from 'vue-property-decorator'
import VueTypes from 'vue-types'

export type Axis = 'both' | 'x' | 'y' | 'none'
export type ResizeHandleAxis = 's' | 'w' | 'e' | 'n' | 'sw' | 'nw' | 'se' | 'ne'
export type ResizableState = void
export interface ResizableBoxState {
  width: number, height: number,
  propsWidth: number, propsHeight: number
}
export interface DragCallbackData {
  node: HTMLElement,
  x: number, y: number,
  deltaX: number, deltaY: number,
  lastX: number, lastY: number
}
export interface ResizeCallbackData {
  node: HTMLElement,
  size: {width: number, height: number},
  handle: ResizeHandleAxis
}
export const RESIZABLE_PROPS_ARR: any[] = ['axis', 'className', 'draggableOpts', 'height', 'width', 'handle', 'handleSize', 'lockAspectRatio', 'maxConstraints', 'minConstraints', 'fnResizeStop', 'fnResizeStart', 'fnResize', 'resizeHandles', 'transformScale']

// <Resizable>
export interface Props {
  axis: Axis,
  // children: ReactElement<any>,
  className?: string,
  draggableOpts?: Partial<DraggableCoreProps>,
  height: number,
  handle?: ((resizeHandleAxis: ResizeHandleAxis) => VNode) | VNode,
  handleSize: [number, number],
  lockAspectRatio: boolean,
  minConstraints: [number, number],
  maxConstraints: [number, number],
  fnResizeStop?: (e: Event, data: ResizeCallbackData) => any,
  fnResizeStart?: (e: Event, data: ResizeCallbackData) => any,
  fnResize?: (e: Event, data: ResizeCallbackData) => any,
  resizeHandles: ResizeHandleAxis[],
  transformScale: number,
  width: number,
}

@Component
export class ResizableProps extends Vue {
  /**
   * Restricts resizing to a particular axis (default: 'both')
   * 'both' - allows resizing by width or height
   * 'x' - only allows the width to be changed
   * 'y' - only allows the height to be changed
   * 'none' - disables resizing altogether
   */
  @Prop(VueTypes.oneOf(['both', 'x', 'y', 'none']))
  axis!: Axis

  @Prop(VueTypes.string)
  className!: string

  /**
   * Require that one and only one child be present.
   *
   * These will be passed wholesale to react-draggable's DraggableCore
   */
  @Prop(VueTypes.shape({
    allowAnyClick: VueTypes.bool,
    cancel: VueTypes.string,
    disabled: VueTypes.bool,
    enableUserSelectHack: VueTypes.bool,
    offsetParent: VueTypes.any,
    grid: VueTypes.arrayOf(VueTypes.number),
    handle: VueTypes.string,
    fnStart: VueTypes.func,
    fnDrag: VueTypes.func,
    fnStop: VueTypes.func,
    fnMouseDown: VueTypes.func,
    scale: VueTypes.number,
  }))
  draggableOpts!: Object

  /**
   * Initial height
   */
  @Prop(VueTypes.number.isRequired)
  height!: number

  /**
   * Customize cursor resize handle
   */
  @Prop()
  handle!: string

  /**
   * If you change this, be sure to update your css
   */
  @Prop(VueTypes.arrayOf(VueTypes.number))
  handleSize!: [number, number]

  @Prop({...VueTypes.bool, default: false})
  lockAspectRatio!: boolean

  /**
   * Max X & Y measure
   */
  @Prop(VueTypes.arrayOf(VueTypes.number))
  maxConstraints!: number[]

  /**
   * Min X & Y measure
   */
  @Prop(VueTypes.arrayOf(VueTypes.number))
  minConstraints!: number[]

  /**
   * Called on stop resize event
   */
  @Prop({...VueTypes.func, default: null })
  fnResizeStop!: Function

  /**
   * Called on start resize event
   */
  @Prop({...VueTypes.func, default: null })
  fnResizeStart!: Function

  /**
   * Called on resize event
   */
  @Prop({ ...VueTypes.func, default: null })
  fnResize!: Function

  /**
   * Defines which resize handles should be rendered (default: 'se')
   * 's' - South handle (bottom-center)
   * 'w' - West handle (left-center)
   * 'e' - East handle (right-center)
   * 'n' - North handle (top-center)
   * 'sw' - Southwest handle (bottom-left)
   * 'nw' - Northwest handle (top-left)
   * 'se' - Southeast handle (bottom-right)
   * 'ne' - Northeast handle (top-center)
   */
  @Prop(VueTypes.arrayOf(VueTypes.oneOf(['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne'])))
  resizeHandles!: any

  /**
   * If `transform: scale(n)` is set on the parent, this should be set to `n`.
   */
  @Prop({ ...VueTypes.number, default: 1 })
  transformScale!: number

  /**
   * Initial width
   */
  @Prop(VueTypes.number.isRequired)
  width!: number
}
