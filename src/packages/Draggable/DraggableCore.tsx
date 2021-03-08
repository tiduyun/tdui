// @flow
import { isEmpty, pick } from '@tdio/utils'
import { CreateElement } from 'vue'
import { Component, Mixins } from 'vue-property-decorator'
import {addEvent, addUserSelectStyles, getTouchIdentifier, matchesSelectorAndParentsTo, removeEvent,
        removeUserSelectStyles} from './utils/domFns'
import { PropsMixins } from './utils/mixins'
import {createCoreData, getControlPosition, snapToGrid} from './utils/positionFns'
// import log from './utils/log';
import type {DraggableEventHandler, MouseTouchEvent} from './utils/types'

// Simple abstraction for dragging events names.
const eventsFor = {
  touch: {
    start: 'touchstart',
    move: 'touchmove',
    stop: 'touchend'
  },
  mouse: {
    start: 'mousedown',
    move: 'mousemove',
    stop: 'mouseup'
  }
}

// Default to mouse events.
let dragEventFor = eventsFor.mouse

interface DraggableCoreState {
  dragging: boolean,
  lastX: number,
  lastY: number,
  touchIdentifier?: number | null
}

export interface ControlPosition {x: number, y: number}
export interface PositionOffsetControlPosition {x: number|string, y: number|string}

export interface DraggableCoreProps {
  allowAnyClick: boolean,
  cancel: string,
  disabled: boolean,
  enableUserSelectHack: boolean,
  offsetParent: HTMLElement,
  grid: [number, number],
  handle: string,
  fnStart: DraggableEventHandler,
  fnDrag: DraggableEventHandler,
  fnStop: DraggableEventHandler,
  fnMouseDown: (e: MouseEvent) => void,
  scale: number,
}

//
// Define <DraggableCore>.
//
// <DraggableCore> is for advanced usage of <Draggable>. It maintains minimal internal state so it can
// work well with libraries that require more control over the element.
//

@Component
export class DraggableCore extends Mixins(PropsMixins) {

  get props (): DraggableCoreProps {
    return pick(this, ['allowAnyClick', 'cancel', 'disabled', 'enableUserSelectHack', 'offsetParent', 'handle', 'grid', 'fnStart', 'fnDrag', 'fnStop', 'fnMouseDown', 'scale']) as DraggableCoreProps
  }

  static displayName = 'DraggableCore'

  state: DraggableCoreState = {
    dragging: false,
    // Used while dragging to determine deltas.
    lastX: NaN, lastY: NaN,
    touchIdentifier: null
  }

  isMounted: boolean = false

  mounted () {
    this.isMounted = true
    // Touch handlers must be added with {passive: false} to be cancelable.
    // https://developers.google.com/web/updates/2017/01/scrolling-intervention
    const thisNode = this.findDOMNode()
    if (thisNode) {
      addEvent(thisNode, eventsFor.touch.start, this.onTouchStart, {passive: false})
    }
  }

  beforeDestroy () {
    this.isMounted = false
    // Remove any leftover event handlers. Remove both touch and mouse handlers in case
    // some browser quirk caused a touch event to fire during a mouse move, or vice versa.
    const thisNode = this.findDOMNode()
    if (thisNode) {
      const {ownerDocument} = thisNode
      removeEvent(ownerDocument, eventsFor.mouse.move, this.handleDrag)
      removeEvent(ownerDocument, eventsFor.touch.move, this.handleDrag)
      removeEvent(ownerDocument, eventsFor.mouse.stop, this.handleDragStop)
      removeEvent(ownerDocument, eventsFor.touch.stop, this.handleDragStop)
      removeEvent(thisNode, eventsFor.touch.start, this.onTouchStart, {passive: false})
      if (this.props.enableUserSelectHack) removeUserSelectStyles(ownerDocument)
    }
  }

  // React Strict Mode compatibility: if `nodeRef` is passed, we will use it instead of trying to find
  // the underlying DOM node ourselves. See the README for more information.
  findDOMNode (): HTMLElement {
    // return this.props.nodeRef ? this.props.nodeRef.current : ReactDOM.findDOMNode(this)
    /* tslint:disable: no-console */
    return (this.$el.querySelector('[node-ref="nodeRef"]') || this.$el) as HTMLElement
  }

  handleDragStart (e: MouseTouchEvent) {
    // Make it possible to attach event handlers on top of this one.
    this.props.fnMouseDown(e)

    // Only accept left-clicks.
    if (!this.props.allowAnyClick && typeof e.button === 'number' && e.button !== 0) return false

    // Get nodes. Be sure to grab relative document (could be iframed)
    const thisNode = this.findDOMNode()
    if (!thisNode || !thisNode.ownerDocument || !thisNode.ownerDocument.body) {
      throw new Error('<DraggableCore> not isMounted on DragStart!')
    }
    const {ownerDocument} = thisNode

    // Short circuit if handle or cancel prop was provided and selector doesn't match.
    if (this.props.disabled ||
      (!(e.target instanceof ownerDocument!.defaultView!.Node)) ||
      (this.props.handle && !matchesSelectorAndParentsTo(e.target, this.props.handle, thisNode)) ||
      (this.props.cancel && matchesSelectorAndParentsTo(e.target, this.props.cancel, thisNode))) {
      return
    }

    // Prevent scrolling on mobile devices, like ipad/iphone.
    // Important that this is after handle/cancel.
    if (e.type === 'touchstart') e.preventDefault()

    // Set touch identifier in component state if this is a touch event. This allows us to
    // distinguish between individual touches on multitouch screens by identifying which
    // touchpoint was set to this element.
    const touchIdentifier = getTouchIdentifier(e)
    this.setState({touchIdentifier})

    // Get the current drag point from the event. This is used as the offset.
    const position = getControlPosition(e, this, touchIdentifier)
    if (position == null) return // not possible but satisfies flow
    const {x, y} = position

    // Create an event object with all the data parents need to make a decision here.
    const coreEvent = createCoreData(this, x, y)

    // log('DraggableCore: handleDragStart: %j', coreEvent);

    // Call event handler. If it returns explicit false, cancel.
    // log('calling', this.props.fnStart);
    const shouldUpdate = this.props.fnStart(e, coreEvent)
    if (shouldUpdate === false || this.isMounted === false) return

    // Add a style to the body to disable user-select. This prevents text from
    // being selected all over the page.
    if (this.props.enableUserSelectHack) addUserSelectStyles(ownerDocument)

    // Initiate dragging. Set the current x and y as offsets
    // so we know how much we've moved during the drag. This allows us
    // to drag elements around even if they have been moved, without issue.
    this.setState({
      dragging: true,
      lastX: x,
      lastY: y
    })

    // Add events to the document directly so we catch when the user's mouse/touch moves outside of
    // this element. We use different events depending on whether or not we have detected that this
    // is a touch-capable device.
    addEvent(ownerDocument, dragEventFor.move, this.handleDrag)
    addEvent(ownerDocument, dragEventFor.stop, this.handleDragStop)
    return
  }
  handleDrag (e: MouseTouchEvent) {

    // Get the current drag point from the event. This is used as the offset.
    const position = getControlPosition(e, this, this.state.touchIdentifier)
    if (position == null) return
    let {x, y} = position

    // Snap to grid if prop has been provided
    if (Array.isArray(this.props.grid)) {
      let deltaX = x - this.state.lastX, deltaY = y - this.state.lastY;
      [deltaX, deltaY] = snapToGrid(this.props.grid, deltaX, deltaY)
      if (!deltaX && !deltaY) return // skip useless drag
      x = this.state.lastX + deltaX, y = this.state.lastY + deltaY
    }

    const coreEvent = createCoreData(this, x, y)

    // log('DraggableCore: handleDrag: %j', coreEvent);

    // Call event handler. If it returns explicit false, trigger end.
    const shouldUpdate = this.props.fnDrag(e, coreEvent)
    if (shouldUpdate === false || this.isMounted === false) {
      try {
        // $FlowIgnore
        this.handleDragStop(new MouseEvent('mouseup') as MouseTouchEvent)
      } catch (err) {
        // Old browsers
        const event = ((document.createEvent('MouseEvents') as MouseTouchEvent))
        // I see why this insanity was deprecated
        // $FlowIgnore
        event.initMouseEvent('mouseup', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null)
        this.handleDragStop(event)
      }
      return
    }

    this.setState({
      lastX: x,
      lastY: y
    })
  }
  // EventHandler<MouseTouchEvent>
  handleDragStop (e: MouseTouchEvent) {
    if (!this.state.dragging) return

    const position = getControlPosition(e, this, this.state.touchIdentifier)
    if (position == null) return
    const {x, y} = position
    const coreEvent = createCoreData(this, x, y)

    // Call event handler
    const shouldContinue = this.props.fnStop(e, coreEvent)
    if (shouldContinue === false || this.isMounted === false) return false

    const thisNode = this.findDOMNode()
    if (thisNode) {
      // Remove user-select hack
      if (this.props.enableUserSelectHack) removeUserSelectStyles(thisNode.ownerDocument)
    }

    // log('DraggableCore: handleDragStop: %j', coreEvent);

    // Reset the el.
    this.setState({
      dragging: false,
      lastX: NaN,
      lastY: NaN
    })

    if (thisNode) {
      // Remove event handlers
      // log('DraggableCore: Removing handlers');
      removeEvent(thisNode.ownerDocument, dragEventFor.move, this.handleDrag)
      removeEvent(thisNode.ownerDocument, dragEventFor.stop, this.handleDragStop)
    }
    return
  }

  mouseDown (e: MouseTouchEvent) {
    dragEventFor = eventsFor.mouse // on touchscreen laptops we could switch back to mouse
    return this.handleDragStart(e)
  }

  onMouseUp (e: MouseTouchEvent) {
    dragEventFor = eventsFor.mouse

    return this.handleDragStop(e)
  }
  // Same as fnMouseDown (start drag), but now consider this a touch device.
  onTouchStart (e: MouseTouchEvent) {
    // We're on a touch device now, so change the event handlers
    dragEventFor = eventsFor.touch

    return this.handleDragStart(e)
  }
  onTouchEnd (e: MouseTouchEvent) {
    // We're on a touch device now, so change the event handlers
    dragEventFor = eventsFor.touch

    return this.handleDragStop(e)
  }
  render (h: CreateElement) {
    // Reuse the child provided
    this.$nextTick(() => {
      if (this.$slots.default) {
        // Reuse the child provided
        // This makes it flexible to use whatever element is wanted (div, ul, etc)
        const ElSlots: HTMLElement = this.$slots.default[0].elm as HTMLElement
        // Note: mouseMove handler is attached to document so it will still function
        // when the user drags quickly and leaves the bounds of the element.
        ElSlots.addEventListener('mousedown', this.mouseDown as EventListener, false)
        ElSlots.addEventListener('mouseup', this.onMouseUp as EventListener, false)
        // onTouchStart is added on `mounted` so they can be added with
        // {passive: false}, which allows it to cancel. See
        ElSlots.addEventListener('touchend', this.onTouchEnd as EventListener, false)
      }
    })

    return this.$slots.default
  }

  private setState (item: Kv) {
    Object.assign(this.state, item)
  }
}
