// @flow
export type DraggableEventHandler = (e: MouseEvent, data: DraggableData) => void | false

export interface DraggableData {
  node: HTMLElement,
  x: number, y: number,
  deltaX: number, deltaY: number,
  lastX: number, lastY: number
}

export interface Bounds {
  left?: number, top?: number, right?: number, bottom?: number
}
export interface ControlPosition {x: number, y: number}
export interface PositionOffsetControlPosition {x: number|string, y: number|string}
export type EventHandler<T> = (e: T) => void | false

// Missing in Flow
export class SVGElement extends HTMLElement {
}

// Missing targetTouches
export class TouchEvent2 extends TouchEvent {
  changedTouches: TouchList
  targetTouches: TouchList
}

export type MouseTouchEvent = MouseEvent & TouchEvent2
