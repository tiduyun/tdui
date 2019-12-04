import { CreateElement, VNode } from 'vue'
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'

import { Emittable } from '@/utils/emittable'
import { get, isEmpty, isFunction, isPromise, set, throttle } from '@tdio/utils'

const prefixCls = `v-button`

type Func = Function

@Component({ name: 'v-button' })
@Emittable
export default class Button extends Vue {
  componentName: string = 'vButton'

  lock: boolean = false
  isFirst: boolean = false
  isLast: boolean = false

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

  initialSlot?: VNode[]

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
      this.initialSlot = this.$slots.default
      initLocker()
    })
  }

  render (h: CreateElement) {
    const $slots = this.$slots
    const type = this.type || this.$attrs.type
    const isLoading = this.loading || this.lock

    let text: VNode[] | string | undefined = $slots.default
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

    return (
      <el-button
        class="v-button"
        loading={isLoading}
        props={{ ...this.$attrs, type }}
        on={{ ...this.$listeners, click: this.handleClick }}
      >
        { text || null }
      </el-button>
    )
  }
}
