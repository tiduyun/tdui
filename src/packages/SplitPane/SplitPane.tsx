import { pick } from '@tdio/utils'
import { VNode } from 'vue'
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'
import VueTypes from 'vue-types'

import { eventsFor } from './common'
import Pane from './Pane'
import Resizer, { RESIZER_DEFAULT_CLASSNAME } from './Resizer'

export interface DraggableData {
  node: HTMLElement,
  x: number, y: number,
  deltaX: number, deltaY: number,
  lastX: number, lastY: number
}

export type DraggableEventHandler = (e: MouseEvent, data: DraggableData) => void | false

const unFocus = (document: any, window: Window) => {
  if (document.selection) {
    document.selection.empty()
  } else {
    try {
      window.getSelection()?.removeAllRanges()
      // eslint-disable-next-line no-empty
    } catch (e) {}
  }
}

const getDefaultSize = (defaultSize: number | string, minSize: number, maxSize: number, draggedSize: number | undefined) => {
  if (typeof draggedSize === 'number') {
    const min = typeof minSize === 'number' ? minSize : 0
    const max =
      typeof maxSize === 'number' && maxSize >= 0 ? maxSize : Infinity
    return Math.max(min, Math.min(max, draggedSize))
  }
  if (defaultSize !== undefined) {
    return defaultSize
  }
  return minSize
}

const removeNullChildren = (children: VNode[] | undefined) => {
  return (children || []).filter((c: VNode) => c)
}

export interface SplitPaneProps {
  allowResize: boolean;
  className: string;
  primary: string;
  minSize: number;
  maxSize: number;
  defaultSize: string | number;
  size: string | number;
  split: 'vertical' | 'horizontal';
  styles: any;
  resizerStyle: any;
  paneStyle: any;
  pane1Style: any;
  pane2Style: any;
  paneClassName: string;
  pane1ClassName: string;
  pane2ClassName: string;
  resizerClassName: string;
  step: number;
  fnDragStarted: () => void;
  fnDragFinished: (dragSize?: number) => void;
  fnChange: any;
  fnResizerClick: any;
  fnResizerDoubleClick: any;
}

interface IState {
  active: boolean,
  resized: boolean,
  draggedSize?: number,
  pane1Size?: number | string,
  pane2Size?: number | string,
  position: number,
  instanceProps: {
    size: string | number
  }
}

const SPLIT_PANE_PROPS_ARR: any[] = [
  'allowResize', 'className', 'primary', 'minSize', 'maxSize' ,
  'defaultSize', 'size', 'split', 'styles', 'resizerStyle',
  'paneClassName', 'pane1ClassName', 'pane2ClassName', 'paneStyle',
  'pane1Style', 'pane2Style', 'resizerClassName', 'step',
  'fnDragStarted', 'fnDragFinished', 'fnChange', 'fnResizerClick', 'fnResizerDoubleClick'
]

@Component
export default class SplitPane extends Vue {

  get props (): SplitPaneProps {
    return pick(this, SPLIT_PANE_PROPS_ARR) as any
  }

  // we have to check values since gDSFP is called on every render and more in StrictMode
  static getSizeUpdate (props: SplitPaneProps, state: IState) {
    const newState: Kv = {}
    const { instanceProps } = state

    if (instanceProps.size === props.size && props.size !== undefined) {
      return {}
    }
    const newSize =
      props.size !== undefined
        ? props.size
        : getDefaultSize(
            props.defaultSize,
            props.minSize,
            props.maxSize,
            state.draggedSize
          )

    if (props.size !== undefined) {
      newState.draggedSize = newSize
    }

    const isPanel1Primary = props.primary === 'first'

    newState[isPanel1Primary ? 'pane1Size' : 'pane2Size'] = newSize
    newState[isPanel1Primary ? 'pane2Size' : 'pane1Size'] = undefined

    newState.instanceProps = { size: props.size }
    return newState
  }

  // static getDerivedStateFromProps (nextProps, prevState) {
  //   return SplitPane.getSizeUpdate(nextProps, prevState)
  // }

  @Prop({ ...VueTypes.bool, default: true })
  allowResize!: boolean

  @Prop({ ...VueTypes.number, default: 1 })
  step!: number

  @Prop({ ...VueTypes.oneOf(['first', 'second']), default: 'first' })
  primary!: 'first' | 'second'

  @Prop({ ...VueTypes.oneOfType([VueTypes.string, VueTypes.number]), default: 50 })
  minSize!: string | number

  @Prop({ ...VueTypes.oneOfType([VueTypes.string, VueTypes.number]) })
  maxSize!: string | number

  @Prop({ ...VueTypes.oneOfType([VueTypes.string, VueTypes.number]) })
  defaultSize!: string | number

  @Prop({ ...VueTypes.oneOfType([VueTypes.string, VueTypes.number]) })
  size!: string | number

  @Prop({ ...VueTypes.oneOf(['vertical', 'horizontal']), default: 'vertical' })
  split!: 'vertical' | 'horizontal'

  @Prop({ ...VueTypes.string })
  paneClassName!: string

  @Prop({ ...VueTypes.string })
  pane1ClassName!: string

  @Prop({ ...VueTypes.string })
  pane2ClassName!: string

  @Prop({ type: Object, default: () => ({}) })
  paneStyle!: any

  @Prop({ type: Object, default: () => ({}) })
  pane1Style!: any

  @Prop({ type: Object, default: () => ({}) })
  pane2Style!: any

  @Prop({ type: Object, default: () => ({}) })
  resizerStyle!: any

  @Prop({ type: String, default: '' })
  resizerClassName!: string

  @Prop({ type: Object, default: () => ({}) })
  styles!: any

  @Prop({ ...VueTypes.func })
  fnDragStarted!: () => void

  @Prop({ ...VueTypes.func })
  fnDragFinished!: DraggableEventHandler

  @Prop({ ...VueTypes.func })
  fnChange!: any

  @Prop({ ...VueTypes.func })
  fnResizerClick!: any

  @Prop({ ...VueTypes.func })
  fnResizerDoubleClick!: any

  pane1: Element | null = null
  pane2: Element | null = null
  splitPane: Element | null = null

  state: IState = {
    active: false,
    resized: false,
    draggedSize: undefined,
    pane1Size: undefined,
    pane2Size: undefined,
    position: 0,

    // these are props that are needed in static functions. ie: gDSFP
    instanceProps: {
      size: ''
    }
  }

  created () {
    const { size, defaultSize, minSize, maxSize, primary } = this.props

    const initialSize =
      size !== undefined
        ? size
        : getDefaultSize(defaultSize, minSize, maxSize, undefined)

    this.state.pane1Size = primary === 'first' ? initialSize : undefined
    this.state.pane2Size = primary === 'second' ? initialSize : undefined

    this.state.instanceProps.size = size

  }

  mounted () {
    this.splitPane = this.$refs.splitPane as Element
    this.pane1 = (this.$refs.pane1 as Vue).$el
    this.pane2 = (this.$refs.pane2 as Vue).$el
    document.addEventListener(eventsFor.mouse.stop, this.onMouseUp)
    document.addEventListener(eventsFor.mouse.move, this.onMouseMove as any)
    document.addEventListener(eventsFor.touch.move, this.onTouchMove as any)
    this.setState(SplitPane.getSizeUpdate(this.props, this.state))
  }

  beforeDestroy () {
    document.removeEventListener(eventsFor.mouse.stop, this.onMouseUp)
    document.removeEventListener(eventsFor.mouse.move, this.onMouseMove as any)
    document.removeEventListener(eventsFor.touch.move, this.onTouchMove as any)
  }

  onMouseDown (event: MouseEvent) {
    const eventWithTouches = Object.assign({}, event, {
      touches: [{ clientX: event.clientX, clientY: event.clientY }],
    })
    this.onTouchStart(eventWithTouches)
  }

  onTouchStart (event: MouseEvent) {
    const { allowResize, fnDragStarted, split } = this.props
    if (allowResize) {
      unFocus(document, window)
      const position =
        split === 'vertical'
          ? event.touches[0].clientX
          : event.touches[0].clientY

      if (typeof fnDragStarted === 'function') {
        fnDragStarted()
      }
      this.setState({
        active: true,
        position,
      })
    }
  }

  onMouseMove (event: MouseEvent) {
    const eventWithTouches = Object.assign({}, event, {
      touches: [{ clientX: event.clientX, clientY: event.clientY }],
    })
    this.onTouchMove(eventWithTouches)
  }

  onTouchMove (event: MouseEvent) {
    const { allowResize, maxSize, minSize, fnChange, split, step } = this.props
    const { active, position } = this.state
    if (allowResize && active) {
      unFocus(document, window)
      const isPrimaryFirst = this.props.primary === 'first'
      const ref = isPrimaryFirst ? this.pane1 : this.pane2
      const ref2 = isPrimaryFirst ? this.pane2 : this.pane1
      if (ref) {
        const node = ref
        const node2 = ref2

        if (node.getBoundingClientRect) {
          const width = node.getBoundingClientRect().width
          const height = node.getBoundingClientRect().height
          const current =
            split === 'vertical'
              ? event.touches[0].clientX
              : event.touches[0].clientY
          const size = split === 'vertical' ? width : height
          let positionDelta = position - current
          if (step) {
            if (Math.abs(positionDelta) < step) {
              return
            }
            // Integer division
            // eslint-disable-next-line no-bitwise
            positionDelta = ~~(positionDelta / step) * step
          }
          let sizeDelta = isPrimaryFirst ? positionDelta : -positionDelta

          const pane1Order = parseInt(window.getComputedStyle(node).order, 0)
          const pane2Order = parseInt(window.getComputedStyle(node2 as Element).order, 0)
          if (pane1Order > pane2Order) {
            sizeDelta = -sizeDelta
          }

          let newMaxSize: number = maxSize
          if (maxSize !== undefined && maxSize <= 0) {
            const splitPane = this.splitPane
            if (split === 'vertical') {
              newMaxSize = (splitPane as Element).getBoundingClientRect().width + maxSize
            } else {
              newMaxSize = (splitPane as Element).getBoundingClientRect().height + maxSize
            }
          }

          let newSize = size - sizeDelta
          const newPosition = position - positionDelta

          if (newSize < minSize) {
            newSize = minSize
          } else if (maxSize !== undefined && newSize > newMaxSize) {
            newSize = newMaxSize
          } else {
            this.setState({
              position: newPosition,
              resized: true,
            })
          }

          if (fnChange) fnChange(newSize)
          this.setState({
            draggedSize: newSize,
            [isPrimaryFirst ? 'pane1Size' : 'pane2Size']: newSize,
          })
        }
      }
    }
  }

  onMouseUp () {
    const { allowResize, fnDragFinished } = this.props
    const { active, draggedSize } = this.state
    if (allowResize && active) {
      if (typeof fnDragFinished === 'function') {
        fnDragFinished(draggedSize)
      }
      this.setState({ active: false })
    }
  }

  render () {
    const {
      allowResize,
      className,
      fnResizerClick,
      fnResizerDoubleClick,
      paneClassName,
      pane1ClassName,
      pane2ClassName,
      paneStyle,
      pane1Style,
      pane2Style,
      resizerClassName,
      resizerStyle,
      split,
      styles: styleProps,
    } = this.props
    const { pane1Size, pane2Size } = this.state

    const disabledClass = allowResize ? '' : 'disabled'
    const resizerClassNamesIncludingDefault = resizerClassName
      ? `${resizerClassName} ${RESIZER_DEFAULT_CLASSNAME}`
      : resizerClassName

    const notNullChildren = removeNullChildren(this.$slots.default)

    const style = {
      display: 'flex',
      flex: 1,
      height: '100%',
      position: 'absolute',
      outline: 'none',
      overflow: 'hidden',
      MozUserSelect: 'text',
      WebkitUserSelect: 'text',
      msUserSelect: 'text',
      userSelect: 'text',
      ...styleProps,
    }

    if (split === 'vertical') {
      Object.assign(style, {
        flexDirection: 'row',
        left: 0,
        right: 0,
      })
    } else {
      Object.assign(style, {
        bottom: 0,
        flexDirection: 'column',
        minHeight: '100%',
        top: 0,
        width: '100%',
      })
    }

    const classes = ['SplitPane', className, split, disabledClass]

    const pane1Styles = { ...paneStyle, ...pane1Style }
    const pane2Styles = { ...paneStyle, ...pane2Style }

    const pane1Classes = ['Pane1', paneClassName, pane1ClassName].join(' ')
    const pane2Classes = ['Pane2', paneClassName, pane2ClassName].join(' ')

    return (
      <div
        class={classes.join(' ')}
        ref="splitPane"
        style={style}
      >
        <Pane
          className={pane1Classes}
          key="pane1"
          eleRef="pane1"
          ref="pane1"
          size={pane1Size}
          split={split}
          styles={pane1Styles}
        >
          {notNullChildren[0]}
        </Pane>
        <Resizer
          className={disabledClass}
          fnClick={fnResizerClick}
          fnDoubleClick={fnResizerDoubleClick}
          fnMouseDown={this.onMouseDown}
          fnTouchStart={this.onTouchStart}
          fnTouchEnd={this.onMouseUp}
          key="resizer"
          resizerClassName={resizerClassNamesIncludingDefault}
          split={split}
          styles={resizerStyle || {}}
        />
        <Pane
          className={pane2Classes}
          key="pane2"
          ref="pane2"
          eleRef="pane2"
          size={pane2Size}
          split={split}
          styles={pane2Styles}
        >
          {notNullChildren[1]}
        </Pane>
      </div>
    )
  }

  @Watch('size')
  handleVisible (size: number | string) {
    this.setState(SplitPane.getSizeUpdate(this.props, this.state))
  }

  private setState (item: Kv) {
    Object.assign(this.state, item)
  }
}
