// @flow
import { pick } from '@tdio/utils'
import classNames from 'classnames'
import { CreateElement } from 'vue'
import { Component, Prop, Ref, Vue } from 'vue-property-decorator'

import { debounce } from '@/utils/decorators'
import { functionalComponent } from '@/utils/vue'

interface WPState {
  width: number
}

@Component
class WidthProvideRGL extends Vue {
  @Prop()
  component!: Vue

  @Ref()
  $provider!: Vue

  width: number = 0

  beforeDestroy () {
    window.removeEventListener('resize', this.onWindowResize)
  }

  mounted () {
    window.addEventListener('resize', this.onWindowResize)
    // Call to properly set the breakpoint and resize the elements.
    // Note that if you're doing a full-width element, this can get a little wonky if a scrollbar
    // appears because of the grid. In that case, fire your own resize event, or set `overflow: scroll` on your body.
    this.onWindowResize()
  }

  onWindowResize () {
    if (!this._isMounted) return
    const node = this.$provider.$el
    // const node = this.elementRef.current // Flow casts this to Text | Element
    // fix: grid position error when node or parentNode display is none by window resize
    // #924 #1084
    if (node instanceof HTMLElement && node.offsetWidth) {
      this.width = node.offsetWidth
    }
  }

  render () {
    const { ...rest } = this.$attrs
    const props = {
      is: this.component,
      props: {
        ...rest,
        width: this.width
      }
    }
    return (
      <component
        ref="$provider"
        { ...props }
        on={this.$listeners}
      >
        {this.$slots.default}
      </component>
    )
  }

  private setState (item: Kv) {
    Object.assign(this.state, item)
  }
}

export function WidthProvider (component: Vue) {
  return functionalComponent(function (h: CreateElement, context: Kv) {
    const { props, on } = context
    return (
      <WidthProvideRGL
        props={{
          component
        }}
        on={on}
        attrs={
          props
        }
      >{this.children}</WidthProvideRGL>
    )
  })
}
