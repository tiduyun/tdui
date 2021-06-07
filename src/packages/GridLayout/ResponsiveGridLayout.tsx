// @flow
import { isEqual, pick } from '@tdio/utils'
import { VNode } from 'vue'
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'
import VueTypes from 'vue-types'

import { GridLayout } from './GridLayout'
import {
  Breakpoints,
  findOrGenerateResponsiveLayout,
  getBreakpointFromWidth,
  getColsFromBreakpoint,
  OnLayoutChangeCallback,
  ResponsiveLayout
} from './responsiveUtils'
import {
  cloneLayout,
  Layout,
  noop,
  synchronizeLayoutWithChildren,
  validateLayout
} from './utils'

// $FlowFixMe[method-unbinding]
const type = (obj: any) => Object.prototype.toString.call(obj)

/**
 * Get a value of margin or containerPadding.
 *
 * @param  {Array | Object} param Margin | containerPadding, e.g. [10, 10] | {lg: [10, 10], ...}.
 * @param  {String} breakpoint   Breakpoint: lg, md, sm, xs and etc.
 * @return {Array}
 */
// [number, number]
function getIndentationValue<T = [number, number]> (
  param: { [key: string]: T } | T,
  breakpoint: string
): T | [] {
  // $FlowIgnore TODO fix this typedef
  if (param == null) return []
  // $FlowIgnore TODO fix this typedef
  return Array.isArray(param) ? param : (param as Kv)[breakpoint]
}

interface State {
  layout: Layout,
  breakpoint: string,
  cols: number,
  layouts?: ResponsiveLayout
}

interface Props<Breakpoint> {
  // Responsive config
  verticalCompact: boolean;
  compactType: 'vertical' | 'vertical';
  breakpoint?: Breakpoint,
  breakpoints: Breakpoints,
  cols: { [key: string]: number },
  layouts: ResponsiveLayout,
  width: number,
  allowOverlap: boolean,
  margin: { [key: string]: [number, number] } | [number, number],
  /* prettier-ignore */
  containerPadding: { [key: string]: [number, number] } | [number, number],

  // Callbacks
  fnBreakpointChange: (Breakpoint: Breakpoint, cols: number) => void,
  fnLayoutChange: OnLayoutChangeCallback,
  fnWidthChange: (
    containerWidth: number,
    margin: [number, number] | [],
    cols: number,
    containerPadding?: [number, number] | []
  ) => void
}

const RESPONSIVE_GRID_PROPS: any[] = [
  'breakpoint', 'breakpoints', 'allowOverlap', 'cols', 'margin', 'containerPadding',
  'layouts', 'width', 'fnBreakpointChange', 'fnLayoutChange', 'fnWidthChange', 'verticalCompact',
  'fnDrop', 'rowHeight', 'useCSSTransforms', 'maxRows', 'isBounded', 'isDraggable',
  'isResizable', 'isDroppable', 'preventCollision', 'transformScale', 'droppingItem'
]

@Component
export class ResponsiveReactGridLayout extends Vue {
  // This should only include propTypes needed in this code; RGL itself
  // will do validation of the rest props passed to it.

  static getDerivedStateFromProps (
    nextProps: Props<any>,
    prevState: State
  ) {
    if (!isEqual(nextProps.layouts, prevState.layouts)) {
      // Allow parent to set layouts directly.
      const { breakpoint, cols } = prevState

      // Since we're setting an entirely new layout object, we must generate a new responsive layout
      // if one does not exist.
      const newLayout = findOrGenerateResponsiveLayout(
        nextProps.layouts,
        nextProps.breakpoints,
        breakpoint,
        breakpoint,
        cols,
        nextProps.compactType
      )
      return { layout: newLayout, layouts: nextProps.layouts }
    }

    return null
  }

  // Optional, but if you are managing width yourself you may want to set the breakpoint
  // yourself as well.
  @Prop(VueTypes.string)
  breakpoint!: string

  // {name: pxVal}, e.g. {lg: 1200, md: 996, sm: 768, xs: 480}
  @Prop(VueTypes.object.def({ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }))
  breakpoints!: Object

  @Prop(VueTypes.bool.def(false))
  allowOverlap!: boolean

  // # of cols. This is a breakpoint -> cols map
  @Prop(VueTypes.object.def({ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }))
  cols!: Object

  // # of margin. This is a breakpoint -> margin map
  // e.g. { lg: [5, 5], md: [10, 10], sm: [15, 15] }
  // Margin between items [x, y] in px
  // e.g. [10, 10]
  @Prop(VueTypes.oneOfType([VueTypes.array, VueTypes.object]).def([10, 10]))
  margin!: any

  @Prop(VueTypes.number.def(undefined))
  rowHeight!: number

  @Prop(VueTypes.bool)
  useCSSTransforms!: boolean

  @Prop(VueTypes.number.def(undefined))
  maxRows!: number

  @Prop(VueTypes.bool)
  isBounded!: boolean

  @Prop(VueTypes.bool)
  isDraggable!: boolean

  @Prop(VueTypes.bool)
  isResizable!: boolean

  @Prop(VueTypes.bool)
  isDroppable!: boolean

  @Prop(VueTypes.bool)
  preventCollision!: boolean

  @Prop(VueTypes.number.def(undefined))
  transformScale!: number

  @Prop(VueTypes.oneOfType([VueTypes.array, VueTypes.object]).def(
    { lg: null, md: null, sm: null, xs: null, xxs: null }
  ))
  containerPadding!: any

  @Prop(VueTypes.shape({
    i: VueTypes.string.isRequired,
    w: VueTypes.number.isRequired,
    h: VueTypes.number.isRequired
  }))
  droppingItem!: any

  // layouts is an object mapping breakpoints to layouts.
  // e.g. {lg: Layout, md: Layout, ...}
  @Prop(VueTypes.custom(value => {
    if (type(value) !== '[object Object]') {
      throw new Error(
        'Layout property must be an object. Received: ' +
          type(value)
      )
    }
    return true
  }).def({}))
  layouts!: Object

  // The width of this component.
  // Required in this propTypes stanza because generateInitialState() will fail without it.
  @Prop(VueTypes.number.isRequired)
  width!: number

  // Calls back with breakpoint and new # cols
  @Prop(VueTypes.func.def(noop))
  fnBreakpointChange!: Function

  // Callback so you can save the layout.
  // Calls back with (currentLayout, allLayouts). allLayouts are keyed by breakpoint.
  @Prop(VueTypes.func.def(noop))
  fnLayoutChange!: Function

  // Calls back with (containerWidth, margin, cols, containerPadding)
  @Prop(VueTypes.func.def(noop))
  fnWidthChange!: Function

  @Prop(VueTypes.func)
  fnDrop!: Function

  @Prop(VueTypes.custom((value) => {
    if (value === false) {
      console.warn(
        // eslint-disable-line no-console
        '`verticalCompact` on <GridLayout> is deprecated and will be removed soon. ' +
          'Use `compactType`: "horizontal" | "vertical" | null.'
      )
    }
    return true
  }))
  verticalCompact!: boolean

  // Choose vertical or hotizontal compaction
  @Prop(VueTypes.oneOf([
    'vertical',
    'horizontal'
  ]).def('vertical'))
  compactType!: 'vertical' | 'vertical'

  get props (): Props<any> {
    return pick(this, RESPONSIVE_GRID_PROPS) as any
  }

  state: Kv = {}

  created () {
    this.state = this.generateInitialState()
  }

  generateInitialState (): State {
    const { width, breakpoints, layouts, cols } = this.props
    const breakpoint = getBreakpointFromWidth(breakpoints, width)
    const colNo = getColsFromBreakpoint(breakpoint, cols)
    // verticalCompact compatibility, now deprecated
    const compactType =
      this.props.verticalCompact === false ? null : this.props.compactType
    // Get the initial layout. This can tricky; we try to generate one however possible if one doesn't exist
    // for this layout.
    const initialLayout = findOrGenerateResponsiveLayout(
      layouts,
      breakpoints,
      breakpoint,
      breakpoint,
      colNo,
      compactType
    )
    const rs = {
      layout: initialLayout,
      breakpoint,
      cols: colNo
    }
    return {
      layout: initialLayout,
      breakpoint,
      cols: colNo
    }
  }

  // wrap layouts so we do not need to pass layouts to child
  onLayoutChange (layout: Layout) {
    this.props.fnLayoutChange(layout, {
      ...this.props.layouts,
      [this.state.breakpoint]: layout
    })
  }

  /**
   * When the width changes work through breakpoints and reset state with the new width & breakpoint.
   * Width changes are necessary to figure out the widget widths.
   */
  onWidthChange (prevProps: Props<any>) {
    const { breakpoints, cols, layouts, compactType } = this.props
    const newBreakpoint =
      this.props.breakpoint ||
      getBreakpointFromWidth(this.props.breakpoints, this.props.width)

    const lastBreakpoint = this.state.breakpoint
    const newCols: number = getColsFromBreakpoint(newBreakpoint, cols)
    const newLayouts = { ...layouts }

    // Breakpoint change
    if (
      lastBreakpoint !== newBreakpoint ||
      prevProps.breakpoints !== breakpoints ||
      prevProps.cols !== cols
    ) {
      // Preserve the current layout if the current breakpoint is not present in the next layouts.
      if (!(lastBreakpoint in newLayouts))
        newLayouts[lastBreakpoint] = cloneLayout(this.state.layout)

      // Find or generate a new layout.
      let layout = findOrGenerateResponsiveLayout(
        newLayouts,
        breakpoints,
        newBreakpoint,
        lastBreakpoint,
        newCols,
        compactType
      )

      // This adds missing items.
      layout = synchronizeLayoutWithChildren(
        layout,
        // this.props.children,
        this.$slots.default || [],
        newCols,
        compactType,
        this.props.allowOverlap
      )

      // Store the new layout.
      newLayouts[newBreakpoint] = layout

      // callbacks
      this.props.fnLayoutChange(layout, newLayouts)
      this.props.fnBreakpointChange(newBreakpoint, newCols)

      this.setState({
        breakpoint: newBreakpoint,
        layout,
        cols: newCols
      })
    }

    const margin = getIndentationValue(this.props.margin, newBreakpoint)
    const containerPadding = getIndentationValue(
      this.props.containerPadding,
      newBreakpoint
    )

    // call onWidthChange on every change of width, not only on breakpoint changes
    this.props.fnWidthChange(
      this.props.width,
      margin,
      newCols,
      containerPadding
    )
  }

  render (): VNode {
    /* eslint-disable no-unused-vars */
    const {
      breakpoint,
      breakpoints,
      cols,
      layouts,
      margin,
      containerPadding,
      fnBreakpointChange,
      fnLayoutChange,
      fnWidthChange,
      ...other
    } = this.props
    /* eslint-enable no-unused-vars */

    return (
      <GridLayout
        // $FlowIgnore should allow nullable here due to DefaultProps
        props={{
          ...other,
          margin: getIndentationValue(margin, this.state.breakpoint),
          containerPadding: getIndentationValue(
            containerPadding,
            this.state.breakpoint
          ),
          fnLayoutChange: this.onLayoutChange,
          value: this.state.layout,
          cols: this.state.cols
        }}
      >{this.$slots.default}</GridLayout>
    )
  }

  @Watch('props')
  handleUpdate (prevProps: Props<any>) {
    // Allow parent to set width or breakpoint directly.
    if (
      this.props.width !== prevProps.width ||
      this.props.breakpoint !== prevProps.breakpoint ||
      !isEqual(this.props.breakpoints, prevProps.breakpoints) ||
      !isEqual(this.props.cols, prevProps.cols)
    ) {
      this.onWidthChange(prevProps)
    }
  }

  private setState (item: Kv) {
    Object.assign(this.state, item)
  }
}
