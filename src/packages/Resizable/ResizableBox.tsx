// @flow
import { pick } from '@tdio/utils'
import { VNode } from 'vue'
import { Component, Mixins, Prop } from 'vue-property-decorator'

import { Resizable } from './Resizable'
import {RESIZABLE_PROPS_ARR, ResizableBoxState, ResizableProps, ResizeCallbackData} from './utils/propTypes'

// <ResizableBox> does not have defaultProps, so we can use this type to tell Flow that we don't
// care about that and will handle it in <Resizable> instead.

@Component
export class ResizableBox extends Mixins(ResizableProps) {
  // A <ResizableBox> can also have a `styles` property.
  @Prop()
  styles!: CSSStyleDeclaration

  get props () {
    return pick(this, RESIZABLE_PROPS_ARR) as any
  }

  state: ResizableBoxState = {
    width: this.props.width,
    height: this.props.height,
    propsWidth: this.props.width,
    propsHeight: this.props.height,
  }

  // static getDerivedStateFromProps(props: ResizableBoxProps, state: ResizableBoxState) {
  //   // If parent changes height/width, set that in our state.
  //   if (state.propsWidth !== props.width || state.propsHeight !== props.height) {
  //     return {
  //       width: props.width,
  //       height: props.height,
  //       propsWidth: props.width,
  //       propsHeight: props.height,
  //     };
  //   }
  //   return null;
  // }

  onResize (e: Event, data: ResizeCallbackData) {
    const {size} = data
    if (this.props.fnResize) {
       if (e.persist) {
        e.persist()
      }
       this.setState(this.props.fnResize && this.props.fnResize(e, data))
    } else {
      this.setState(size)
    }
  }

  render (): VNode {
    // Basic wrapper around a Resizable instance.
    // If you use Resizable directly, you are responsible for updating the child component
    // with a new width and height.
    const {
      handle,
      handleSize,
      fnResize,
      fnResizeStart,
      fnResizeStop,
      draggableOpts,
      minConstraints,
      maxConstraints,
      lockAspectRatio,
      axis,
      width,
      height,
      resizeHandles,
      transformScale,
      className,
      ...props
    } = this.props
    return (
      <Resizable
        axis={axis}
        draggableOpts={draggableOpts}
        handle={handle}
        handleSize={handleSize}
        height={this.state.height}
        lockAspectRatio={lockAspectRatio}
        maxConstraints={maxConstraints}
        minConstraints={minConstraints}
        fnResizeStart={fnResizeStart}
        fnResize={this.onResize}
        fnResizeStop={fnResizeStop}
        resizeHandles={resizeHandles}
        transformScale={transformScale}
        className={className}
        width={this.state.width}
      >
        <div style={{ ...this.styles, width: `${this.state.width}px`, height: `${this.state.height}px` }}>{this.$slots.default}</div>
      </Resizable>
    )
  }

  private setState (item: Kv) {
    Object.assign(this.state, item)
  }
}
