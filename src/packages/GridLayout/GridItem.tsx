// @flow
import { merge, pick } from '@tdio/utils'
import classNames from 'classnames'
import { CreateElement, VNode } from 'vue'
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'
import VueTypes from 'vue-types'
import { DraggableCore } from '../Draggable'
import { Resizable } from '../Resizable'
import {
  calcGridColWidth,
  calcGridItemPosition,
  calcGridItemWHPx,
  calcWH,
  calcXY,
  clamp
} from './calculateUtils'
import { perc, setTopLeft, setTransform } from './utils'

import type {
  DroppingPosition,
  GridDragEvent,
  GridResizeEvent,
  Position,
} from './utils'

import { PositionParams } from './calculateUtils'

// 引入样式
import type {
  ResizeHandle,
  ResizeHandleAxis
} from './GridLayoutPropTypes'
import './style/gridItem.scss'

interface PartialPosition { top: number, left: number }
type GridItemCallback<T> = (
  i: string,
  w: number,
  h: number,
  Data: any
) => void

interface IRectInfo {
  width: number;
  height: number;
}

interface IPositionInfo {
  left: number;
  top: number;
}

interface State {
  resizing: IRectInfo | null;
  dragging: IPositionInfo | null;
  className: string
}

interface Props {
  cols: number,
  containerWidth: number,
  margin: [number, number],
  containerPadding: [number, number],
  rowHeight: number,
  maxRows: number,
  isDraggable: boolean,
  isResizable: boolean,
  isBounded: boolean,
  static?: boolean,
  useCSSTransforms?: boolean,
  usePercentages?: boolean,
  transformScale: number,
  droppingPosition?: DroppingPosition,

  className: string,
  styles?: Object,

  // Draggability
  cancel: string,
  handle: string,

  x: number,
  y: number,
  w: number,
  h: number,

  minW: number,
  maxW: number,
  minH: number,
  maxH: number,
  i: string,

  resizeHandles?: ResizeHandleAxis[],
  resizeHandle?: ResizeHandle,

  fnDrag?: GridItemCallback<GridDragEvent>,
  fnDragStart?: GridItemCallback<GridDragEvent>,
  fnDragStop?: GridItemCallback<GridDragEvent>,
  fnResize?: GridItemCallback<GridResizeEvent>,
  fnResizeStart?: GridItemCallback<GridResizeEvent>,
  fnResizeStop?: GridItemCallback<GridResizeEvent>
}

interface DefaultProps {
  className: string,
  cancel: string,
  handle: string,
  minH: number,
  minW: number,
  maxH: number,
  maxW: number,
  transformScale: number
}

const GRID_ITEM_PROPS: any[] = [
  'cols', 'containerWidth', 'maxRows', 'containerWidth', 'containerPadding',
  'x', 'y', 'w', 'h', 'minW', 'minH', 'maxW', 'maxH', 'i', 'styles', 'resizeHandle',
  'fnDragStop', 'fnDragStart', 'fnDrag', 'fnResizeStop', 'resizeHandles',
  'fnResizeStart', 'fnResize', 'isDraggable', 'isResizable', 'rowHeight',
  'isBounded', 'static', 'useCSSTransforms', 'transformScale', 'usePercentages',
  'className', 'handle', 'cancel', 'droppingPosition', 'margin'
]

/**
 * An individual item within a ReactGridLayout.
 */
@Component
export default class GridItem extends Vue {
  // General grid attributes
  @Prop(VueTypes.number.isRequired)
  cols!: number

  @Prop(VueTypes.number.isRequired)
  containerWidth!: number

  @Prop(VueTypes.number.isRequired)
  rowHeight!: number

  @Prop(VueTypes.array.isRequired)
  margin!: [number,  number]

  @Prop(VueTypes.number.isRequired)
  maxRows!: number

  @Prop(VueTypes.array.isRequired)
  containerPadding!: [number, number]

  @Prop(VueTypes.number.isRequired)
  x!: number

  @Prop(VueTypes.number.isRequired)
  y!: number

  @Prop(VueTypes.number.isRequired)
  w!: number

  @Prop(VueTypes.number.isRequired)
  h!: number

  @Prop(VueTypes.number.def(1))
  minW!: number

  @Prop(VueTypes.number.def(Infinity))
  maxW!: number

  @Prop(VueTypes.number.def(1))
  minH!: number

  @Prop(VueTypes.number.def(Infinity))
  maxH!: number

  @Prop(VueTypes.string.isRequired)
  i!: string

  @Prop(VueTypes.arrayOf(
    VueTypes.oneOf(['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne'])
  ))
  resizeHandles!: ResizeHandleAxis[]

  @Prop(VueTypes.oneOfType([VueTypes.any, VueTypes.func]))
  resizeHandle!: ResizeHandle

  // Functions
  @Prop(VueTypes.func)
  fnDragStop!: GridItemCallback<GridDragEvent>

  @Prop(VueTypes.func)
  fnDragStart!: GridItemCallback<GridDragEvent>

  @Prop(VueTypes.func)
  fnDrag!: GridItemCallback<GridDragEvent>

  @Prop(VueTypes.func)
  fnResizeStop!: GridItemCallback<GridDragEvent>

  @Prop(VueTypes.func)
  fnResizeStart!: GridItemCallback<GridDragEvent>

  @Prop(VueTypes.func)
  fnResize!: GridItemCallback<GridDragEvent>

  // Flags
  @Prop(VueTypes.bool.isRequired)
  isDraggable!: boolean

  @Prop(VueTypes.bool.isRequired)
  isResizable!: boolean

  @Prop(VueTypes.bool.isRequired)
  isBounded!: boolean

  @Prop(VueTypes.bool)
  static!: boolean

  // Use CSS transforms instead of top/left
  @Prop(VueTypes.bool.isRequired)
  useCSSTransforms!: boolean

  @Prop(VueTypes.bool.def(false))
  usePercentages!: boolean

  @Prop(VueTypes.number.def(1))
  transformScale!: number

  // Others
  @Prop(VueTypes.string.def(''))
  className!: string

  @Prop()
  styles!: CSSStyleDeclaration

  // Selector for draggable handle
  @Prop(VueTypes.string.def(''))
  handle!: string

  // Selector for draggable cancel (see react-draggable)
  @Prop(VueTypes.string.def(''))
  cancel!: string

  // Current position of a dropping element
  @Prop(VueTypes.shape({
    e: VueTypes.object.isRequired,
    left: VueTypes.number.isRequired,
    top: VueTypes.number.isRequired
  }))
  droppingPosition!: string

  get props (): Props {
    return pick(this, GRID_ITEM_PROPS) as any
  }

  state: State = {
    resizing: null,
    dragging: null,
    className: ''
  }

  gridItemClass: string = ''

  mounted () {
    this.$nextTick(this.syncUI)
    this.moveDroppingItem({})
  }

  // When a droppingPosition is present, this means we should fire a move event, as if we had moved
  // this element by `x, y` pixels.
  moveDroppingItem (prevProps: Partial<Props>) {
    const { droppingPosition } = this.props
    if (!droppingPosition) return
    this.$nextTick(() => {
      const node = this.$el

      // Can't find DOM node (are we unmounted?)
      if (!node) return
      const prevDroppingPosition = prevProps.droppingPosition || {
        left: 0,
        top: 0
      }
      const { dragging } = this.state

      const shouldDrag =
        (dragging && droppingPosition.left !== prevDroppingPosition.left) ||
        droppingPosition.top !== prevDroppingPosition.top

      if (!dragging) {
        this.onDragStart(droppingPosition.e, {
          node,
          deltaX: droppingPosition.left,
          deltaY: droppingPosition.top
        })
      } else if (shouldDrag) {
        const deltaX = droppingPosition.left - dragging.left
        const deltaY = droppingPosition.top - dragging.top

        this.onDrag(droppingPosition.e, {
          node,
          deltaX,
          deltaY
        })
      }
    })
  }

  getPositionParams (props: Props = this.props): PositionParams {
    return {
      cols: props.cols,
      containerPadding: props.containerPadding,
      containerWidth: props.containerWidth,
      margin: props.margin,
      maxRows: props.maxRows,
      rowHeight: props.rowHeight
    }
  }

  /**
   * This is where we set the grid item's absolute placement. It gets a little tricky because we want to do it
   * well when server rendering, and the only way to do that properly is to use percentage width/left because
   * we don't know exactly what the browser viewport is.
   * Unfortunately, CSS Transforms, which are great for performance, break in this instance because a percentage
   * left is relative to the item itself, not its container! So we cannot use them on the server rendering pass.
   *
   * @param  {Object} pos Position object with width, height, left, top.
   * @return {Object}     Style object.
   */
  createStyle (pos: Position): { [key: string]: string } {
    const { usePercentages, containerWidth, useCSSTransforms } = this.props

    let style: Kv = {}
    // CSS Transforms support (default)
    if (useCSSTransforms) {
      style = setTransform(pos)
    } else {
      // top,left (slow)
      style = setTopLeft(pos)

      // This is used for server rendering.
      if (usePercentages) {
        style.left = perc(pos.left / containerWidth)
        style.width = perc(pos.width / containerWidth)
      }
    }

    return style
  }

  /**
   * Mix a Draggable instance into a child.
   * @param  {Element} child    Child element.
   * @return {Element}          Child wrapped in Draggable.
   */
  mixinDraggable (
    child: VNode,
    isDraggable: boolean
  ): VNode {
    return (
      <DraggableCore
        disabled={!isDraggable}
        fnStart={this.onDragStart}
        fnDrag={this.onDrag}
        fnStop={this.onDragStop}
        handle={this.props.handle}
        cancel={
          '.vue-resizable-handle' +
          (this.props.cancel ? ',' + this.props.cancel : '')
        }
        scale={this.props.transformScale}
        node-ref="nodeRef"
      >
        {child}
      </DraggableCore>
    )
  }

  /**
   * Mix a Resizable instance into a child.
   * @param  {Element} child    Child element.
   * @param  {Object} position  Position object (pixel values)
   * @return {Element}          Child wrapped in Resizable.
   */
  mixinResizable (
    child: VNode,
    position: Position,
    isResizable: boolean
  ): VNode {
    const {
      cols,
      x,
      minW,
      minH,
      maxW,
      maxH,
      transformScale,
      resizeHandles,
      resizeHandle
    } = this.props
    const positionParams = this.getPositionParams()

    // This is the max possible width - doesn't go to infinity because of the width of the window
    const maxWidth = calcGridItemPosition(positionParams, 0, 0, cols - x, 0)
      .width

    // Calculate min/max constraints using our min & maxes
    const mins = calcGridItemPosition(positionParams, 0, 0, minW, minH)
    const maxes = calcGridItemPosition(positionParams, 0, 0, maxW, maxH)
    const minConstraints = [mins.width, mins.height]
    const maxConstraints = [
      Math.min(maxes.width, maxWidth),
      Math.min(maxes.height, Infinity)
    ]
    return (
      <Resizable
        // These are opts for the resize handle itself
        draggableOpts={{
          disabled: !isResizable,
        }}
        className={isResizable ? undefined : 'vue-resizable-hide'}
        width={position.width}
        height={position.height}
        minConstraints={minConstraints}
        maxConstraints={maxConstraints}
        fnResizeStop={this.onResizeStop}
        fnResizeStart={this.onResizeStart}
        fnResize={this.onResize}
        transformScale={transformScale}
        resizeHandles={resizeHandles}
        handle={resizeHandle}
      >
        {child}
      </Resizable>
    )
  }

  /**
   * onDragStart event handler
   * @param  {Event}  e             event data
   * @param  {Object} callbackData  an object with node, delta and position information
   */
  onDragStart (e: Event, { node }: any) {
    const { fnDragStart, transformScale } = this.props
    if (!fnDragStart) return

    const newPosition: PartialPosition = { top: 0, left: 0 }

    // TODO: this wont work on nested parents
    const { offsetParent } = node
    if (!offsetParent) return
    const parentRect = offsetParent.getBoundingClientRect()
    const clientRect = node.getBoundingClientRect()
    const cLeft = clientRect.left / transformScale
    const pLeft = parentRect.left / transformScale
    const cTop = clientRect.top / transformScale
    const pTop = parentRect.top / transformScale
    newPosition.left = cLeft - pLeft + offsetParent.scrollLeft
    newPosition.top = cTop - pTop + offsetParent.scrollTop
    this.setState({ dragging: newPosition })

    // Call callback with this data
    const { x, y } = calcXY(
      this.getPositionParams(),
      newPosition.top,
      newPosition.left,
      this.props.w,
      this.props.h
    )

    return fnDragStart(this.props.i, x, y, {
      e,
      node,
      newPosition
    })
  }

  /**
   * onDrag event handler
   * @param  {Event}  e             event data
   * @param  {Object} callbackData  an object with node, delta and position information
   */
  onDrag (e: Event, { node, deltaX, deltaY }: any) {
    const { fnDrag } = this.props
    if (!fnDrag) return

    if (!this.state.dragging) {
      throw new Error('onDrag called before onDragStart.')
    }
    let top = this.state.dragging.top + deltaY
    let left = this.state.dragging.left + deltaX

    const { isBounded, i, w, h, containerWidth } = this.props
    const positionParams = this.getPositionParams()

    // Boundary calculations; keeps items within the grid
    if (isBounded) {
      const { offsetParent } = node

      if (offsetParent) {
        const { margin, rowHeight } = this.props
        const bottomBoundary =
          offsetParent.clientHeight - calcGridItemWHPx(h, rowHeight, margin[1])
        top = clamp(top, 0, bottomBoundary)

        const colWidth = calcGridColWidth(positionParams)
        const rightBoundary =
          containerWidth - calcGridItemWHPx(w, colWidth, margin[0])
        left = clamp(left, 0, rightBoundary)
      }
    }

    const newPosition: PartialPosition = { top, left }
    this.setState({ dragging: newPosition })

    // Call callback with this data
    const { x, y } = calcXY(positionParams, top, left, w, h)
    return fnDrag(i, x, y, {
      e,
      node,
      newPosition
    })
  }

  /**
   * onDragStop event handler
   * @param  {Event}  e             event data
   * @param  {Object} callbackData  an object with node, delta and position information
   */
  onDragStop (e: Event, { node }: { node: HTMLElement }){
    const { fnDragStop } = this.props
    if (!fnDragStop) return

    if (!this.state.dragging) {
      throw new Error('onDragEnd called before onDragStart.')
    }
    const { w, h, i } = this.props
    const { left, top } = this.state.dragging
    const newPosition: PartialPosition = { top, left }
    this.setState({ dragging: null })

    const { x, y } = calcXY(this.getPositionParams(), top, left, w, h)

    return fnDragStop(i, x, y, {
      e,
      node,
      newPosition
    })
  }

  /**
   * onResizeStop event handler
   * @param  {Event}  e             event data
   * @param  {Object} callbackData  an object with node and size information
   */
  onResizeStop (e: Event, callbackData: { node: HTMLElement, size: Position }) {
    this.onResizeHandler(e, callbackData, 'fnResizeStop')
  }

  /**
   * onResizeStart event handler
   * @param  {Event}  e             event data
   * @param  {Object} callbackData  an object with node and size information
   */
  onResizeStart (e: Event, callbackData: { node: HTMLElement, size: Position }) {
    this.onResizeHandler(e, callbackData, 'fnResizeStart')
  }

  /**
   * onResize event handler
   * @param  {Event}  e             event data
   * @param  {Object} callbackData  an object with node and size information
   */
  onResize (e: Event, callbackData: { node: HTMLElement, size: Position }) {
    this.onResizeHandler(e, callbackData, 'fnResize')
  }

  /**
   * Wrapper around drag events to provide more useful data.
   * All drag events call the function with the given handler name,
   * with the signature (index, x, y).
   *
   * @param  {String} handlerName Handler name to wrap.
   * @return {Function}           Handler function.
   */
  onResizeHandler (
    e: Event,
    { node, size }: { node: HTMLElement, size: Position },
    handlerName: string
  ): void {
    const handler = (this.props as Kv)[handlerName]
    if (!handler) return
    const { cols, x, y, i, maxH, minH } = this.props
    let { minW, maxW } = this.props

    // Get new XY
    let { w, h } = calcWH(
      this.getPositionParams(),
      size.width,
      size.height,
      x,
      y
    )

    // minW should be at least 1 (TODO propTypes validation?)
    minW = Math.max(minW, 1)

    // maxW should be at most (cols - x)
    maxW = Math.min(maxW, cols - x)

    // Min/max capping
    w = clamp(w, minW, maxW)
    h = clamp(h, minH, maxH)

    this.setState({ resizing: handlerName === 'fnResizeStop' ? null : size })

    handler(i, w, h, { e, node, size })
  }

  render (): VNode {
    const {
      x,
      y,
      w,
      h,
      isDraggable,
      isResizable
    } = this.props
    const pos = calcGridItemPosition(
      this.getPositionParams(),
      x,
      y,
      w,
      h,
      this.state
    )

    const child: VNode[] = this.$slots.default || []
    const newChild: VNode = this.mixinResizable(child[0], pos, isResizable)

    return this.mixinDraggable(newChild, isDraggable)
  }

  updated () {
    this.syncUI()
  }

  transformClass (str: string): Kv {
    const classArr = str.trim().split(' ')
    const classItems = classArr.reduce((item: Kv, val) => {
      if (val) {
        item[val] = true
      }
      return item
    }, {})
    return classItems
  }

  syncUI () {
    const {
      x,
      y,
      w,
      h,
      isDraggable,
      droppingPosition,
      useCSSTransforms
    } = this.props
    const pos = calcGridItemPosition(
      this.getPositionParams(),
      x,
      y,
      w,
      h,
      this.state
    )
    const child: VNode[] = this.$slots.default || []

    const ElSlots: HTMLElement = child[0].elm as HTMLElement
    const curElClass = this.transformClass(ElSlots.className)
    const propClass = this.transformClass(this.props.className)
    const className = classNames(
      merge(curElClass, propClass, {
        'vue-grid-item': true,
        static: this.props.static,
        resizing: Boolean(this.state.resizing),
        'vue-draggable': isDraggable,
        'vue-draggable-dragging': Boolean(this.state.dragging),
        dropping: Boolean(droppingPosition),
        cssTransforms: useCSSTransforms
      })
    )
    ElSlots.setAttribute('class', className)
    Object.assign(ElSlots.style, {
      ...this.props.styles,
      ...this.createStyle(pos)
    })
  }

  @Watch('$props', { immediate: true })
  handleUpdate (prevProps: Props) {
    this.moveDroppingItem(prevProps)
  }

  private setState (item: Kv) {
    Object.assign(this.state, item)
  }
}
