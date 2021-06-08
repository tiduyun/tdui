// @flow
import { isEmpty, isEqual, pick  } from '@tdio/utils'
import classNames from 'classnames'
import { VNode } from 'vue'
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'
import VueTypes from 'vue-types'

import type {
  ResizeHandle,
  ResizeHandleAxis
} from './GridLayoutPropTypes'
import {
  bottom,
  childrenEqual,
  cloneLayoutItem,
  compact,
  compactType,
  getAllCollisions,
  getLayoutItem,
  moveElement,
  noop,
  synchronizeLayoutWithChildren,
  validateLayout,
  withLayoutItem
} from './utils'

import { calcXY } from './calculateUtils'

import GridItem from './GridItem'

// Types
import type {
  CompactType,
  DragOverEvent,
  DroppingPosition,
  GridDragEvent,
  GridResizeEvent,
  Layout,
  LayoutItem
} from './utils'

import type { PositionParams } from './calculateUtils'

interface State {
  activeDrag?: LayoutItem | null,
  layout: Layout,
  oldDragItem?: LayoutItem | null,
  oldLayout?: Layout | null,
  oldResizeItem?: LayoutItem | null,
  droppingDOMNode?: VNode | null,
  droppingPosition?: DroppingPosition,

  // Mirrored props
  children: VNode[],
  compactType?: CompactType,
  propsLayout?: Layout
}

// 引入样式
import './style/gridLayout.scss'
// import type { DefaultProps, Props } from './GridLayoutPropTypes'

// End Types

const layoutClassName = 'vue-grid-layout'
let isFirefox = false
// Try...catch will protect from navigator not existing (e.g. node) or a bad implementation of navigator
try {
  isFirefox = /firefox/i.test(navigator.userAgent)
} catch (e) {
  /* Ignore */
}

const GRID_LAYOUT_PROPS_ARR: any[] = [
  'className', 'styles', 'width', 'autoSize', 'cols', 'draggableCancel', 'draggableHandle',
  'verticalCompact', 'compactType', 'value', 'margin', 'containerPadding', 'rowHeight', 'maxRows',
  'isBounded', 'isDraggable', 'isResizable', 'allowOverlap', 'preventCollision',
  'useCSSTransforms', 'transformScale', 'isDroppable', 'resizeHandles', 'resizeHandle',
  'fnLayoutChange', 'fnDragStart', 'fnDrag', 'fnDragStop', 'fnResizeStart', 'fnResize',
  'fnResizeStop', 'fnDrop', 'fnDropDragOver', 'droppingItem'
]

/**
 * A reactive, fluid grid layout with draggable, resizable components.
 */
@Component
export class GridLayout extends Vue {
  // TODO publish internal ReactClass displayName transform
  static displayName?: string = 'GridLayout'

  @Prop(VueTypes.string.def(''))
  className!: string

  @Prop(VueTypes.object.def({}))
  styles!: CSSStyleDeclaration

  @Prop(VueTypes.number.def(undefined))
  width!: number

  // If true, the container height swells and contracts to fit contents
  @Prop(VueTypes.bool.def(true))
  autoSize!: boolean

  // # of cols.
  @Prop(VueTypes.number.def(12))
  cols!: number

  // A selector that will not be draggable.
  @Prop(VueTypes.string.def(''))
  draggableCancel!: string

  // A selector for the draggable handler
  @Prop(VueTypes.string.def(''))
  draggableHandle!: string

  // Deprecated
  @Prop(VueTypes.custom((value) => {
    if (value === false) {
      console.warn(
        // eslint-disable-line no-console
        '`verticalCompact` on <GridLayout> is deprecated and will be removed soon. ' +
          'Use `compactType`: "horizontal" | "vertical" | null.'
      )
    }
    return true
  }).def(true))
  verticalCompact!: boolean

  // Choose vertical or hotizontal compaction
  @Prop(VueTypes.oneOf([
    'vertical',
    'horizontal'
  ]).def('vertical'))
  compactType!: 'horizontal' | 'vertical'

  // layout is an array of object with the format:
  // {x: Number, y: Number, w: Number, h: Number, i: String}
  @Prop(VueTypes.custom((value: Layout) => {
    if (value) {
      validateLayout(value, 'layout')
    }
    return true
  }).def([]))
  value!: Layout
  // Margin between items [x, y] in px
  @Prop(VueTypes.arrayOf(VueTypes.number).def([10, 10]))
  margin!: number[]
  // Padding inside the container [x, y] in px
  @Prop(VueTypes.arrayOf(VueTypes.number).def([]))
  containerPadding!: number[]
  // Rows have a static height, but you can change this based on breakpoints if you like
  @Prop(VueTypes.number.def(150))
  rowHeight!: number

  // Default Infinity, but you can specify a max here if you like.
  // Note that this isn't fully fleshed out and won't error if you specify a layout that
  // extends beyond the row capacity. It will, however, not allow users to drag/resize
  // an item past the barrier. They can push items beyond the barrier, though.
  // Intentionally not documented for this reason.
  @Prop(VueTypes.number.def(Infinity))
  maxRows!: number

  @Prop(VueTypes.bool.def(false))
  isBounded!: boolean

  @Prop(VueTypes.bool.def(true))
  isDraggable!: boolean

  @Prop(VueTypes.bool.def(true))
  isResizable!: boolean
  // If true, grid can be placed one over the other.
  @Prop(VueTypes.bool.def(false))
  allowOverlap!: boolean
  // If true, grid items won't change position when being dragged over.
  @Prop(VueTypes.bool.def(false))
  preventCollision!: boolean
  // Use CSS transforms instead of top/left
  @Prop(VueTypes.bool.def(true))
  useCSSTransforms!: boolean
  // parent layout transform scale
  @Prop(VueTypes.number.def(1))
  transformScale!: number
  // If true, an external element can trigger onDrop callback with a specific grid position as a parameter
  @Prop(VueTypes.bool.def(false))
  isDroppable!: boolean

  @Prop(VueTypes.shape({
    i: VueTypes.string.isRequired,
    w: VueTypes.number.isRequired,
    h: VueTypes.number.isRequired
  }).def({
    i: '__dropping-elem__',
    h: 1,
    w: 1
  }))
  droppingItem!: any

  // Resize handle options
  @Prop(VueTypes.arrayOf(
    VueTypes.oneOf(['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne'])
  ).def(['se']))
  resizeHandles!: ResizeHandleAxis

  @Prop()
  resizeHandle!: ResizeHandle

  @Prop(VueTypes.func.def(noop))
  fnLayoutChange!: Function

  @Prop(VueTypes.func.def(noop))
  fnDragStart!: Function

  @Prop(VueTypes.func.def(noop))
  fnDrag!: Function

  @Prop(VueTypes.func.def(noop))
  fnDragStop!: Function

  @Prop(VueTypes.func.def(noop))
  fnResizeStart!: Function

  @Prop(VueTypes.func.def(noop))
  fnResize!: Function

  @Prop(VueTypes.func.def(noop))
  fnResizeStop!: Function

  @Prop(VueTypes.func.def(noop))
  fnDrop!: Function

  @Prop(VueTypes.func.def(noop))
  fnDropDragOver!: Function

  get props () {
    return pick(this, GRID_LAYOUT_PROPS_ARR) as any
  }

  state: State = {
    activeDrag: null,
    layout: [],
    oldDragItem: null,
    oldLayout: null,
    oldResizeItem: null,
    droppingDOMNode: null,
    children: []
  }

  dragEnterCounter: number = 0

  created () {
    this.setState({
      layout: synchronizeLayoutWithChildren(
        this.props.value,
        // this.props.children,
        this.$slots.default || [],
        this.props.cols,
        // Legacy support for verticalCompact: false
        compactType(this.props) as CompactType,
        this.props.allowOverlap
      )
    })
  }

  /**
   * Calculates a pixel value for the container.
   * @return {String} Container height in pixels.
   */
  containerHeight (): string {
    if (!this.props.autoSize) return ''
    const nbRow = bottom(this.state.layout)
    const containerPaddingY = !isEmpty(this.props.containerPadding)
      ? this.props.containerPadding[1]
      : this.props.margin[1]
    return (
      nbRow * this.props.rowHeight +
      (nbRow - 1) * this.props.margin[1] +
      containerPaddingY * 2 +
      'px'
    )
  }

  /**
   * When dragging starts
   * @param {String} i Id of the child
   * @param {Number} x X position of the move
   * @param {Number} y Y position of the move
   * @param {Event} e The mousedown event
   * @param {Element} node The current dragging DOM element
   */
  onDragStart (i: string, x: number, y: number, { e, node }: GridDragEvent) {
    const { layout } = this.state
    const l = getLayoutItem(layout, i)
    if (!l) return

    this.setState({
      oldDragItem: cloneLayoutItem(l),
      oldLayout: [...this.state.layout]
    })

    return this.props.fnDragStart(layout, l, l, null, e, node)
  }

  /**
   * Each drag movement create a new dragelement and move the element to the dragged location
   * @param {String} i Id of the child
   * @param {Number} x X position of the move
   * @param {Number} y Y position of the move
   * @param {Event} e The mousedown eventz
   * @param {Element} node The current dragging DOM element
   */
  onDrag (i: string, x: number, y: number, { e, node }: GridDragEvent)  {
    const { oldDragItem } = this.state
    let { layout } = this.state
    const { cols, allowOverlap } = this.props
    const l = getLayoutItem(layout, i)
    if (!l) return

    // Create placeholder (display only)
    const placeholder = {
      w: l.w,
      h: l.h,
      x: l.x,
      y: l.y,
      placeholder: true,
      i
    }

    // Move the element to the dragged location.
    const isUserAction = true
    layout = moveElement(
      layout,
      l,
      x,
      y,
      isUserAction,
      this.props.preventCollision,
      compactType(this.props) as CompactType,
      cols,
      allowOverlap
    )

    this.props.fnDrag(layout, oldDragItem, l, placeholder, e, node)

    this.setState({
      layout: allowOverlap
        ? [...layout]
        : [... compact(layout, compactType(this.props) as CompactType, cols)],
      activeDrag: placeholder
    })
  }

  /**
   * When dragging stops, figure out which position the element is closest to and update its x and y.
   * @param  {String} i Index of the child.
   * @param {Number} x X position of the move
   * @param {Number} y Y position of the move
   * @param {Event} e The mousedown event
   * @param {Element} node The current dragging DOM element
   */
  onDragStop (i: string, x: number, y: number, { e, node }: GridDragEvent) {
    if (!this.state.activeDrag) return

    const { oldDragItem } = this.state
    let { layout } = this.state
    const { cols, preventCollision, allowOverlap } = this.props
    const l = getLayoutItem(layout, i)
    if (!l) return

    // Move the element here
    const isUserAction = true
    layout = moveElement(
      layout,
      l,
      x,
      y,
      isUserAction,
      preventCollision,
      compactType(this.props) as CompactType,
      cols,
      allowOverlap
    )

    this.props.fnDragStop(layout, oldDragItem, l, null, e, node)

    // Set state
    const newLayout = allowOverlap
      ? layout
      : compact(layout, compactType(this.props) as CompactType, cols)
    const { oldLayout } = this.state
    this.setState({
      activeDrag: null,
      layout: [...newLayout],
      oldDragItem: null,
      oldLayout: null
    })

    this.onLayoutMaybeChanged(newLayout, oldLayout as Layout)
  }

  onLayoutMaybeChanged (newLayout: Layout, oldLayout?: Layout | null) {
    if (!oldLayout) oldLayout = this.state.layout
    if (!isEqual(oldLayout, newLayout)) {
      // this.state.layout = newLayout
      const layout = synchronizeLayoutWithChildren(
        newLayout,
        // this.props.children,
        this.$slots.default || [],
        this.props.cols,
        // Legacy support for verticalCompact: false
        compactType(this.props) as CompactType,
        this.props.allowOverlap
      )
      this.setState({ layout })
      this.props.fnLayoutChange(newLayout)
      this.$emit('input', layout)
    }
  }

  onResizeStart (i: string, w: number, h: number, { e, node }: GridResizeEvent) {
    const { layout } = this.state
    const l = getLayoutItem(layout, i)
    if (!l) return

    this.setState({
      oldResizeItem: cloneLayoutItem(l),
      oldLayout: [...this.state.layout]
    })

    this.props.fnResizeStart(layout, l, l, null, e, node)
  }

  onResize (i: string, w: number, h: number, { e, node }: GridResizeEvent) {
    const { layout, oldResizeItem } = this.state
    const { cols, preventCollision, allowOverlap } = this.props

    const [newLayout, l] = withLayoutItem(layout, i, l => {
      // Something like quad tree should be used
      // to find collisions faster
      let hasCollisions
      if (preventCollision && !allowOverlap) {
        const collisions = getAllCollisions(layout, { ...l, w, h }).filter(
          layoutItem => layoutItem.i !== l.i
        )
        hasCollisions = collisions.length > 0

        // If we're colliding, we need adjust the placeholder.
        if (hasCollisions) {
          // adjust w && h to maximum allowed space
          let leastX = Infinity,
            leastY = Infinity
          collisions.forEach(layoutItem => {
            if (layoutItem.x > l.x) leastX = Math.min(leastX, layoutItem.x)
            if (layoutItem.y > l.y) leastY = Math.min(leastY, layoutItem.y)
          })

          if (Number.isFinite(leastX)) l.w = leastX - l.x
          if (Number.isFinite(leastY)) l.h = leastY - l.y
        }
      }

      if (!hasCollisions) {
        // Set new width and height.
        l.w = w
        l.h = h
      }

      return l
    })

    // Shouldn't ever happen, but typechecking makes it necessary
    if (!l) return

    // Create placeholder element (display only)
    const placeholder = {
      w: l.w,
      h: l.h,
      x: l.x,
      y: l.y,
      static: true,
      i
    }

    this.props.fnResize(newLayout, oldResizeItem, l, placeholder, e, node)

    // Re-compact the newLayout and set the drag placeholder.
    this.setState({
      layout: allowOverlap
        ? [...newLayout]
        : compact(newLayout, compactType(this.props) as CompactType, cols),
      activeDrag: placeholder
    })
  }

  onResizeStop (i: string, w: number, h: number, { e, node }: GridResizeEvent) {
    const { layout, oldResizeItem } = this.state
    const { cols, allowOverlap } = this.props
    const l = getLayoutItem(layout, i)

    this.props.fnResizeStop(layout, oldResizeItem, l, null, e, node)

    // Set state
    const newLayout = allowOverlap
      ? layout
      : compact(layout, compactType(this.props) as CompactType, cols)
    const { oldLayout } = this.state
    this.setState({
      activeDrag: null,
      layout: [...newLayout],
      oldResizeItem: null,
      oldLayout: null
    })

    this.onLayoutMaybeChanged(newLayout, oldLayout)
  }

  /**
   * Create a placeholder object.
   * @return {Element} Placeholder div.
   */
  placeholder (): VNode | null {
    const { activeDrag } = this.state
    if (!activeDrag) return null
    const {
      width,
      cols,
      margin,
      containerPadding,
      rowHeight,
      maxRows,
      useCSSTransforms,
      transformScale
    } = this.props
    // {...this.state.activeDrag} is pretty slow, actually
    return (
      <GridItem
        w={activeDrag.w}
        h={activeDrag.h}
        x={activeDrag.x}
        y={activeDrag.y}
        i={activeDrag.i}
        className="vue-grid-placeholder"
        containerWidth={width}
        cols={cols}
        margin={margin}
        containerPadding={isEmpty(containerPadding) ? margin : containerPadding}
        maxRows={maxRows}
        rowHeight={rowHeight}
        isDraggable={false}
        isResizable={false}
        isBounded={false}
        useCSSTransforms={useCSSTransforms}
        transformScale={transformScale}
      >
        <div />
      </GridItem>
    )
  }

  /**
   * Given a grid item, set its style attributes & surround in a <Draggable>.
   * @param  {Element} child React element.
   * @return {Element}       Element wrapped in draggable and properly placed.
   */
  processGridItem (
    child: VNode,
    isDroppingItem?: boolean
  ) {
    if (!child || (!child.key && child.key !== 0)) return
    const l = getLayoutItem(this.state.layout, String(child.key))
    if (!l) return null
    const {
      width,
      cols,
      margin,
      containerPadding,
      rowHeight,
      maxRows,
      isDraggable,
      isResizable,
      isBounded,
      useCSSTransforms,
      transformScale,
      draggableCancel,
      draggableHandle,
      resizeHandles,
      resizeHandle
    } = this.props
    const { droppingPosition } = this.state

    // Determine user manipulations possible.
    // If an item is static, it can't be manipulated by default.
    // Any properties defined directly on the grid item will take precedence.
    const draggable =
      typeof l.isDraggable === 'boolean'
        ? l.isDraggable
        : !l.static && isDraggable
    const resizable =
      typeof l.isResizable === 'boolean'
        ? l.isResizable
        : !l.static && isResizable
    const resizeHandlesOptions = l.resizeHandles || resizeHandles

    // isBounded set on child if set on parent, and child is not explicitly false
    const bounded = draggable && isBounded && l.isBounded !== false
    const nodes = (
      <GridItem
        key={child.key}
        containerWidth={width}
        cols={cols}
        margin={margin}
        containerPadding={isEmpty(containerPadding) ? margin : containerPadding}
        maxRows={maxRows}
        rowHeight={rowHeight}
        cancel={draggableCancel}
        handle={draggableHandle}
        fnDragStop={this.onDragStop}
        fnDragStart={this.onDragStart}
        fnDrag={this.onDrag}
        fnResizeStart={this.onResizeStart}
        fnResize={this.onResize}
        fnResizeStop={this.onResizeStop}
        isDraggable={draggable}
        isResizable={resizable}
        isBounded={bounded}
        useCSSTransforms={useCSSTransforms && this._isMounted}
        usePercentages={!this._isMounted}
        transformScale={transformScale}
        w={l.w}
        h={l.h}
        x={l.x}
        y={l.y}
        i={l.i}
        minH={l.minH}
        minW={l.minW}
        maxH={l.maxH}
        maxW={l.maxW}
        static={l.static}
        droppingPosition={isDroppingItem ? droppingPosition : undefined}
        resizeHandles={resizeHandlesOptions}
        resizeHandle={resizeHandle}
      >
        {child}
      </GridItem>
    )
    return nodes
  }

  // Called while dragging an element. Part of browser native drag/drop API.
  // Native event target might be the layout itself, or an element within the layout.
  onDragOver (e: Event): void | false {
    e.preventDefault() // Prevent any browser native action
    e.stopPropagation()

    // we should ignore events from layout's children in Firefox
    // to avoid unpredictable jumping of a dropping placeholder
    // FIXME remove this hack
    if (
      isFirefox &&
      // $FlowIgnore can't figure this out
      !(e.target as any)?.classList.contains(layoutClassName)
    ) {
      return false
    }

    const {
      droppingItem,
      fnDropDragOver,
      margin,
      cols,
      rowHeight,
      maxRows,
      width,
      containerPadding
    } = this.props
    // Allow user to customize the dropping item or short-circuit the drop based on the results
    // of the `onDragOver(e: Event)` callback.
    const onDragOverResult = fnDropDragOver?.(e)
    if (onDragOverResult === false) return false
    const finalDroppingItem = { ...droppingItem, ...onDragOverResult }

    const { layout } = this.state
    // This is relative to the DOM element that this event fired for.
    const { layerX, layerY } = e
    const droppingPosition = { left: layerX, top: layerY, e }

    if (!this.state.droppingDOMNode) {
      const positionParams: PositionParams = {
        cols,
        margin,
        maxRows,
        rowHeight,
        containerWidth: width,
        containerPadding: containerPadding || margin
      }

      const calculatedPosition = calcXY(
        positionParams,
        layerY,
        layerX,
        finalDroppingItem.w,
        finalDroppingItem.h
      )

      this.setState({
        droppingDOMNode: <div key={finalDroppingItem.i} />,
        droppingPosition,
        layout: [
          ...layout,
          {
            ...finalDroppingItem,
            x: calculatedPosition.x,
            y: calculatedPosition.y,
            static: false,
            isDraggable: true
          }
        ]
      })
    } else if (this.state.droppingPosition) {
      const { left, top } = this.state.droppingPosition
      const shouldUpdatePosition = left !== layerX || top !== layerY
      if (shouldUpdatePosition) {
        this.setState({ droppingPosition })
      }
    }
  }

  removeDroppingPlaceholder () {
    const { droppingItem, cols } = this.props
    const { layout } = this.state

    const newLayout = compact(
      layout.filter(l => l.i !== droppingItem.i),
      compactType(this.props) as CompactType,
      cols
    )

    this.setState({
      layout: [...newLayout],
      droppingDOMNode: null,
      activeDrag: null,
      droppingPosition: undefined
    })
  }

  onDragLeave (e: Event) {
    e.preventDefault() // Prevent any browser native action
    this.dragEnterCounter--

    // onDragLeave can be triggered on each layout's child.
    // But we know that count of dragEnter and dragLeave events
    // will be balanced after leaving the layout's container
    // so we can increase and decrease count of dragEnter and
    // when it'll be equal to 0 we'll remove the placeholder
    if (this.dragEnterCounter === 0) {
      this.removeDroppingPlaceholder()
    }
  }

  onDragEnter (e: Event) {
    e.preventDefault() // Prevent any browser native action
    this.dragEnterCounter++
  }

  onDrop (e: Event) {
    e.preventDefault() // Prevent any browser native action
    const { droppingItem } = this.props
    const { layout } = this.state
    const item = layout.find(l => l.i === droppingItem.i)

    // reset dragEnter counter on drop
    this.dragEnterCounter = 0

    this.removeDroppingPlaceholder()

    this.props.fnDrop(layout, item, e)
  }

  render (): VNode {
    const { className, style, isDroppable } = this.props

    const mergedClassName = classNames(layoutClassName, className)
    const mergedStyle = {
      height: this.containerHeight(),
      ...style
    }
    return (
      <div
        class={mergedClassName}
        style={mergedStyle}
        ondrop={isDroppable ? this.onDrop : noop}
        ondragleave={isDroppable ? this.onDragLeave : noop}
        ondragenter={isDroppable ? this.onDragEnter : noop}
        ondragover={isDroppable ? this.onDragOver : noop}
      >
        {
          (this.$slots.default as VNode[]).map(child => this.processGridItem(child))
        }
        { isDroppable &&
          this.state.droppingDOMNode &&
          this.processGridItem(this.state.droppingDOMNode, true)}
        {this.placeholder()}
      </div>
    )
  }

  @Watch('value')
  updateLayout (layout: Layout, oldLayout: Layout) {
    if (!this.state.activeDrag) {
      this.onLayoutMaybeChanged(layout, oldLayout)
    }
  }

  private setState (item: Kv) {
    Object.assign(this.state, item)
  }
}
