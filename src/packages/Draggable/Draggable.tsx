// @flow
import { pick } from '@tdio/utils'
import classNames from 'classnames'
import { CreateElement, VNode } from 'vue'
import { Component, Mixins, Prop } from 'vue-property-decorator'
import VueTypes from 'vue-types'
import { DraggableCore } from './DraggableCore'
import { ControlPosition, DraggableCoreProps, PositionOffsetControlPosition } from './DraggableCore'
import { createCSSTransform, createSVGTransform } from './utils/domFns'
import log from './utils/log'
import { PropsMixins } from './utils/mixins'
import { canDragX, canDragY, createDraggableData, getBoundPosition } from './utils/positionFns'
import { Bounds, DraggableData } from './utils/types'

interface DraggableState {
  dragging: boolean,
  dragged: boolean,
  x: number, y: number,
  slackX: number, slackY: number,
  isElementSVG: boolean,
  prevPropsPosition?: ControlPosition,
}

interface DraggableSelfProps {
  axis: 'both' | 'x' | 'y' | 'none',
  bounds: Bounds | string | false,
  defaultClassName: string,
  defaultClassNameDragging: string,
  defaultClassNameDragged: string,
  defaultPosition: ControlPosition,
  positionOffset: PositionOffsetControlPosition,
  position: ControlPosition,
  scale: number
}

export type DraggableProps = DraggableCoreProps & DraggableSelfProps

const CORE_PROPS_ARR: any[] = ['allowAnyClick', 'cancel', 'disabled', 'enableUserSelectHack', 'handle', 'grid', 'fnStart', 'fnDrag', 'fnStop', 'fnMouseDown', 'offsetParent', 'scale']
const DRAGGABLE_PROPS_ARR: any[] = ['axis', 'bounds', 'defaultClassName', 'defaultClassNameDragging', 'defaultClassNameDragged', 'defaultPosition', 'positionOffset', 'position']

//
// Define <Draggable>
//
@Component
export class Draggable extends Mixins(PropsMixins) {

  get props (): DraggableProps {
    return pick(this, [...CORE_PROPS_ARR, ...DRAGGABLE_PROPS_ARR]) as any
  }

  get draggableCoreProps (): DraggableCoreProps {
    return pick(this, CORE_PROPS_ARR) as any
  }

  static displayName = 'Draggable'

  // React 16.3+
  // Arity (props, state)
  static getDerivedStateFromProps ({position}: DraggableProps, {prevPropsPosition}: DraggableState) {
    // Set x/y if a new position is provided in props that is different than the previous.
    if (
      position &&
      (!prevPropsPosition ||
        position.x !== prevPropsPosition.x || position.y !== prevPropsPosition.y
      )
    ) {
      log('Draggable: getDerivedStateFromProps %j', {position, prevPropsPosition})
      return {
        x: position.x,
        y: position.y,
        prevPropsPosition: {...position}
      }
    }
    return null
  }

  /**
   * `axis` determines which axis the draggable can move.
   *
   *  Note that all callbacks will still return data as normal. This only
   *  controls flushing to the DOM.
   *
   * 'both' allows movement horizontally and vertically.
   * 'x' limits movement to horizontal axis.
   * 'y' limits movement to vertical axis.
   * 'none' limits all movement.
   *
   * Defaults to 'both'.
   */
  @Prop({ ...VueTypes.oneOf(['both', 'x', 'y', 'none']), default: 'both' })
  axis!: 'both' | 'x' | 'y' | 'none'

  /**
   * `bounds` determines the range of movement available to the element.
   * Available values are:
   *
   * 'parent' restricts movement within the Draggable's parent node.
   *
   * Alternatively, pass an object with the following properties, all of which are optional:
   *
   * {left: LEFT_BOUND, right: RIGHT_BOUND, bottom: BOTTOM_BOUND, top: TOP_BOUND}
   *
   * All values are in px.
   *
   * Example:
   *
   * ```jsx
   *   let App = React.createClass({
   *       render: function () {
   *         return (
   *            <Draggable bounds={{right: 300, bottom: 300}}>
   *              <div>Content</div>
   *           </Draggable>
   *         );
   *       }
   *   });
   * ```
   */
  @Prop({ ...VueTypes.oneOfType([
    VueTypes.shape({
      left: VueTypes.number,
      right: VueTypes.number,
      top: VueTypes.number,
      bottom: VueTypes.number
    }),
    VueTypes.string,
    VueTypes.oneOf([false])
  ]), default: false }) bounds!: Bounds | string | false

  @Prop({ ...VueTypes.string, default: 'vue-draggable' })
  defaultClassName!: string

  @Prop({ ...VueTypes.string, default: 'vue-draggable-dragging' })
  defaultClassNameDragging!: string

  @Prop({ ...VueTypes.string, default: 'vue-draggable-dragged' })
  defaultClassNameDragged!: string
  /**
   * `defaultPosition` specifies the x and y that the dragged item should start at
   *
   * Example:
   *
   * ```jsx
   *      let App = React.createClass({
   *          render: function () {
   *              return (
   *                  <Draggable defaultPosition={{x: 25, y: 25}}>
   *                      <div>I start with transformX: 25px and transformY: 25px;</div>
   *                  </Draggable>
   *              );
   *          }
   *      });
   * ```
   */
  @Prop({ ...VueTypes.shape({
    x: VueTypes.number,
    y: VueTypes.number
  }), default: () => ({x: 0, y: 0}) })
  defaultPosition!: ControlPosition

  @Prop(VueTypes.shape({
    x: VueTypes.oneOfType([VueTypes.number, VueTypes.string]),
    y: VueTypes.oneOfType([VueTypes.number, VueTypes.string])
  }))
  positionOffset!: PositionOffsetControlPosition
  /**
   * `position`, if present, defines the current position of the element.
   *
   *  This is similar to how form elements in React work - if no `position` is supplied, the component
   *  is uncontrolled.
   *
   * Example:
   *
   * ```jsx
   *      let App = React.createClass({
   *          render: function () {
   *              return (
   *                  <Draggable position={{x: 25, y: 25}}>
   *                      <div>I start with transformX: 25px and transformY: 25px;</div>
   *                  </Draggable>
   *              );
   *          }
   *      });
   * ```
   */
  @Prop({ ...VueTypes.shape({
    x: VueTypes.number,
    y: VueTypes.number
  }), default: null })
  position!: PositionOffsetControlPosition

  state = {
    // Whether or not we are currently dragging.
    dragging: false,

    // Whether or not we have been dragged before.
    dragged: false,

    // Current transform x and y.
    x: this.props.position ? this.props.position.x : this.props.defaultPosition.x,
    y: this.props.position ? this.props.position.y : this.props.defaultPosition.y,

    prevPropsPosition: {...this.props.position},

    // Used for compensating for out-of-bounds drags
    slackX: 0, slackY: 0,

    // Can only determine if SVG after mounting
    isElementSVG: false
  }

  created () {
    const { props } = this
    if (props.position && !(props.fnDrag || props.fnStop)) {
      /* tslint:disable: no-console */
      console.warn('A `position` was applied to this <Draggable>, without drag handlers. This will make this ' +
        'component effectively undraggable. Please attach `fnDrag` or `fnStop` handlers so you can adjust the ' +
        '`position` of this element.')
    }
  }

  mounted () {
    // Check to see if the element passed is an instanceof SVGElement
    if (typeof window.SVGElement !== 'undefined' && this.findDOMNode() instanceof window.SVGElement) {
      this.setState({isElementSVG: true})
    }
  }

  beforeDestroy () {
    this.setState({dragging: false}) // prevents invariant if unmounted while dragging
  }

  // React Strict Mode compatibility: if `nodeRef` is passed, we will use it instead of trying to find
  // the underlying DOM node ourselves. See the README for more information.
  findDOMNode (): HTMLElement {
    return (this.$el.querySelector('[node-ref="nodeRef"]') || this.$el) as HTMLElement
  }

  onDragStart (e: MouseEvent, coreData: DraggableData) {
    log('Draggable: onDragStart: %j', coreData)

    // Short-circuit if user's callback killed it.
    const shouldStart = this.props.fnStart(e, createDraggableData(this, coreData))
    // Kills start event on core as well, so move handlers are never bound.
    if (shouldStart === false) return false

    this.setState({dragging: true, dragged: true})
    return
  }
  // DraggableEventHandler
  onDrag (e: MouseEvent, coreData: DraggableData) {
    if (!this.state.dragging) return false
    log('Draggable: fnDrag: %j', coreData)

    const uiData = createDraggableData(this, coreData)

    const newState: any = {
      x: uiData.x,
      y: uiData.y,
      slackX: null,
      slackY: null
    }

    // Keep within bounds.
    if (this.props.bounds) {
      // Save original x and y.
      const {x, y} = newState

      // Add slack to the values used to calculate bound position. This will ensure that if
      // we start removing slack, the element won't react to it right away until it's been
      // completely removed.
      newState.x += this.state.slackX
      newState.y += this.state.slackY

      // Get bound position. This will ceil/floor the x and y within the boundaries.
      const [newStateX, newStateY] = getBoundPosition(this, newState.x, newState.y)
      newState.x = newStateX
      newState.y = newStateY

      // Recalculate slack by noting how much was shaved by the boundPosition handler.
      newState.slackX = this.state.slackX + (x - newState.x)
      newState.slackY = this.state.slackY + (y - newState.y)

      // Update the event we fire to reflect what really happened after bounds took effect.
      uiData.x = newState.x
      uiData.y = newState.y
      uiData.deltaX = newState.x - this.state.x
      uiData.deltaY = newState.y - this.state.y
    }

    // Short-circuit if user's callback killed it.
    const shouldUpdate = this.props.fnDrag(e, uiData)
    if (shouldUpdate === false) return false

    this.setState(newState)
    return
  }
  onDragStop (e: MouseEvent, coreData: DraggableData) {
    if (!this.state.dragging) return false

    // Short-circuit if user's callback killed it.
    const shouldContinue = this.props.fnStop(e, createDraggableData(this, coreData))
    if (shouldContinue === false) return false

    log('Draggable: onDragStop: %j', coreData)

    const newState: any = {
      dragging: false,
      slackX: 0,
      slackY: 0
    }

    // If this is a controlled component, the result of this operation will be to
    // revert back to the old position. We expect a handler on `onDragStop`, at the least.
    const controlled = Boolean(this.props.position)
    if (controlled) {
      const {x, y} = this.props.position
      newState.x = x
      newState.y = y
    }

    this.setState(newState)
    return
  }
  render (h: CreateElement): VNode {
    const {
      axis,
      bounds,
      defaultPosition,
      defaultClassName,
      defaultClassNameDragging,
      defaultClassNameDragged,
      position,
      positionOffset,
      scale,
      ...draggableCoreProps
    } = this.props

    let style = {}
    let svgTransform: any = null

    // If this is controlled, we don't want to move it - unless it's dragging.
    const controlled = Boolean(position)
    const draggable = !controlled || this.state.dragging

    const validPosition = position || defaultPosition
    const transformOpts = {
      // Set left if horizontal drag is enabled
      x: canDragX(this) && draggable ?
        this.state.x :
        validPosition.x,

      // Set top if vertical drag is enabled
      y: canDragY(this) && draggable ?
        this.state.y :
        validPosition.y
    }

    // If this element was SVG, we use the `transform` attribute.
    if (this.state.isElementSVG) {
      svgTransform = createSVGTransform(transformOpts, positionOffset)
    } else {
      // Add a CSS transform to move the element around. This allows us to move the element around
      // without worrying about whether or not it is relatively or absolutely positioned.
      // If the item you are dragging already has a transform set, wrap it in a <span> so <Draggable>
      // has a clean slate.
      style = createCSSTransform(transformOpts, positionOffset)
    }

    // Mark with class while dragging
    this.$nextTick(() => {
      if (this.$slots.default) {
        const ElSlots: HTMLElement = this.$slots.default[0].elm as HTMLElement
        const className = classNames((ElSlots.getAttribute('className') || ''), defaultClassName, {
          [defaultClassNameDragging]: this.state.dragging,
          [defaultClassNameDragged]: this.state.dragged
        })
        ElSlots.setAttribute('class', className)
        // add multiple css styles
        Object.assign(ElSlots.style, style)
        if (svgTransform) {
          ElSlots.setAttribute('transform', svgTransform)
        }
      }
    })

    // Reuse the child provided
    // This makes it flexible to use whatever element is wanted (div, ul, etc)
    return (
      <DraggableCore props={{...draggableCoreProps, fnStart: this.onDragStart, fnDrag: this.onDrag, fnStop: this.onDragStop}}>
        { this.$slots.default }
      </DraggableCore>
    )
  }

  private setState (item: Kv) {
    Object.assign(this.state, item)
  }
}
