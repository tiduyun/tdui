import { CreateElement } from 'vue'
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'

import { addClass, hasClass, removeClass } from '@tdio/dom-utils'
import { defaultTo, isValue } from '@tdio/utils'
import { Emittable } from '@tdio/vue-utils'

import Button from './Button'

import './ButtonGroup.scss'

declare module 'vue/types/vue' {
  interface Vue {
    [key: string]: any;
  }
}

const prefixCls = 'v-button-group'

const arrayIndexOf = [].indexOf

const getBtnValue = (c: Vue) => defaultTo(c.value, c.$attrs.value)

@Component({
  name: 'v-button-group',
  inheritAttrs: false,
  components: { Button }
})
@Emittable
export default class ButtonGroup extends Vue {
  componentName: string = 'vButtonGroup'

  buttons: Vue[] = []
  checkedList: any[] = []

  @Prop({ type: String, default: 'v-button--active' })
  activeClass!: string

  @Prop(String)
  type!: string

  @Prop({
    type: String,
    default: '',
    validator: (v: string) => ['xsmall', 'small', 'large', ''].includes(v)
  })
  size!: string

  @Prop({
    type: String,
    default: '',
    validator: (v: string) => ['circle', ''].includes(v)
  })
  shape!: string

  @Prop(Boolean)
  vertical!: boolean

  @Prop(Boolean)
  flat!: boolean

  @Prop({ type: [String, Number], default: '' })
  value!: string

  @Prop({ type: Boolean, default: true })
  defaultFirstChecked!: boolean

  get classes () {
    return [
      `${prefixCls}`,
      {
        'el-button-group': !!this.flat,
        [`${prefixCls}--${this.type}`]: !!this.type,
        [`${prefixCls}--${this.size}`]: !!this.size,
        [`${prefixCls}--${this.shape}`]: !!this.shape,
        [`${prefixCls}--vertical`]: this.vertical
      }
    ]
  }

  get firstVisibleChild () {
    return this.buttons.find(b => b.visible)
  }

  get lastVisibleChild () {
    for (let i = this.buttons.length - 1; i > 0; i--) {
      const b = this.buttons[i]
      if (b.visible) return b
    }
    return null
  }

  initComponents () {
    const buttons = this.$children.filter(o => /button\b/i.test(o.$options.name || ''))

    this.buttons = buttons

    // sort by rendering index
    buttons.sort(({ $el: a }, { $el: b }) => {
      const aIndex = arrayIndexOf.call((a as any).parentNode.children, a as never)
      const bIndex = arrayIndexOf.call((b as any).parentNode.children, b as never)
      return aIndex - bIndex
    })

    this.handleButtonVisible()

    buttons.forEach((btn: Vue) => {
      if (!btn.$bound) {
        btn.$bound = true
        btn.$on('click', this.handleChange.bind(this, btn))
      }
      if (this.type) {
        btn.type = this.type
      }
      const val = getBtnValue(btn)
      btn.checked = isValue(val) && val === this.value
    })

    if (this.defaultFirstChecked && buttons.length > 0 && !buttons.some(o => o.checked)) {
      buttons[0].checked = true
      let v
      if (this.value !== (v = getBtnValue(buttons[0]))) {
        this.$emit('input', v)
      }
    }

    this.$nextTick(() => {
      this.updateModel()
    })
  }

  updateModel () {
    const activeClass = this.activeClass
    this.buttons.forEach((child) => {
      const has = hasClass(child.$el, activeClass)
      if (child.checked) {
        if (!has) addClass(child.$el, activeClass)
      } else if (has) removeClass(child.$el, activeClass)
    })
  }

  handleChange (child: Vue, ...args: any[]) {
    if ((this.buttons.length === 1 && this.buttons[0].checked) || child.checked) {
      return
    }

    const prev = this.buttons.find(v => v.checked && v !== child)
    if (prev) {
      prev.checked = false
    }

    child.checked = true

    this.checkedList = this.buttons.filter(o => o.checked).map(o => getBtnValue(o))
    this.$emit('input', this.checkedList[0], () => this.updateModel())

    this.updateModel()
  }

  handleButtonVisible () {
    if (!this.buttons.length) return

    this.broadcast('vButton', 'checkPosition', {
      first: this.firstVisibleChild,
      last: this.lastVisibleChild
    })
  }

  created () {
    this.checkedList = [this.value]
    this.$on('buttonVisibleChanged', this.handleButtonVisible)
  }

  mounted () {
    this.initComponents()
  }

  updated () {
    this.initComponents()
  }

  render () {
    const $slots = this.$slots
    return (
      <div class={this.classes}>
        { $slots.default ? $slots.default : null }
      </div>
    )
  }
}
