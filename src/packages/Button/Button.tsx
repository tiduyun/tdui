import { get, isEmpty, isFunction, isPromise, isString, set, throttle } from '@tdio/utils'
import { Emittable } from '@tdio/vue-utils'
import { CreateElement, VNode } from 'vue'
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'

import { Nil } from '../../types/common'
import { extractTooltip } from '../../utils/normalize'

const prefixCls = `v-button`

type Func = Function
type TextChildNode = VNode | VNode[] | string

@Component({
  name: 'v-button',
  inheritAttrs: false
})
@Emittable
export default class Button extends Vue {
  componentName: string = 'vButton'

  lock: boolean = false
  isFirst: boolean = false
  isLast: boolean = false

  @Prop(String)
  text!: string

  @Prop(Boolean)
  visible!: boolean

  @Prop({ type: [String, Number] })
  value!: boolean

  @Prop(Boolean)
  loading!: boolean

  @Prop(String)
  loadingText!: string

  // public api for <button-group /> injection
  type: string = ''

  initialSlot?: TextChildNode | Nil

  @Watch('visible')
  handleVisible (newVal: boolean) {
    this.dispatch('vButtonGroup', 'buttonVisibleChanged')
  }

  handleClick (...args: any[]) {
    this.$emit('click', ...args)
  }

  handlePositionChange (
    { first, last }: { first: Vue; last: Vue; }
  ) {
    this.isFirst = first === this
    this.isLast = last === this
  }

  getText (): TextChildNode | Nil {
    let textSlot: TextChildNode | undefined = this.$slots.default
    let text: string
    if (!textSlot && (text = this.text)) {
      textSlot = isString(text) ? this._v(text) : text
    }
    return textSlot || null
  }

  created () {
    this.$on('checkPosition', this.handlePositionChange)

    // setup internal locker
    //
    let clickFn: Func

    const newFn = throttle((...args: any[]) => {
      if (this.lock) {
        return
      }
      this.lock = true
      const start = Date.now()
      const rt = clickFn(...args)
      if (isPromise(rt)) {
        rt.finally(() => this.lock = false)
      } else {
        this.lock = false
      }
    }, 600)

    const initLocker = () => {
      if (!this.$el) return

      const $listeners = this.$listeners
      const fns: Func | Func[] | undefined = get($listeners, 'click.fns')
      if (!fns) {
        return
      }

      let pos = 0
      const list: Func[] | undefined = Array.isArray(fns)
        ? fns as Func[]
        : undefined
      const handler = list
        ? list[(pos = fns.length - 1)]
        : fns as Func

      if (!isFunction(handler) || handler === newFn) {
        return
      }

      // update click handle refs
      clickFn = handler

      if (list) {
        list.splice(pos, 1, newFn)
      } else {
        set($listeners, 'click.fns', newFn)
      }
    }

    this.$on('hook:updated', initLocker)
    this.$on('hook:mounted', () => {
      this.initialSlot = this.getText()
      initLocker()
    })
  }

  render () {
    const {
      $slots,
      $attrs,
      $listeners,
      loading,
      lock
    } = this
    const type = this.type || $attrs.type
    const isLoading = loading || lock

    let text = this.getText()
    if (this.loadingText) {
      if (isLoading) {
        // cache the initialize text slots
        if (!this.initialSlot) {
          this.initialSlot = text
        }
        text = this.loadingText
      } else {
        text = this.initialSlot
      }
    }

    const btn = (
      <el-button
        class="v-button"
        loading={isLoading}
        props={{ ...$attrs, type }}
        on={{ ...$listeners, click: this.handleClick }}
      >
        { text }
      </el-button>
    )

    const tooltip = extractTooltip({ ...this.$props, ...$attrs })
    return tooltip && tooltip.content
      ? (<el-tooltip props={tooltip}>{ btn }</el-tooltip>)
      : btn
  }
}
