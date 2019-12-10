import { ElForm } from 'element-ui/types/form'
import { CreateElement, VNode } from 'vue'
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'

import { off, on } from '@/utils/dom'
import { findDownward } from '@/utils/vue'
import { isFunction, isPromise } from '@tdio/utils'

import { IValidateRuleObject } from '../../../../types/validate'

import { Button } from '../../Button'

interface PopoverState<D> {
  props: Kv;
  form: ElForm | null;
  skipValidator: boolean;
  visible: boolean;
  model: D;
  rules: IValidateRuleObject | null;
  listeners: Kv<(e: Event & { data?: D; }) => void | Promise<any>>
  reference: Element & { popoverVm: any } | null;
  scopedSlots: Kv<(h: CreateElement) => VNode>;
  render (this: Popover<D>, h: CreateElement, args: { model: D; rules?: IValidateRuleObject; }): VNode;
}

type PopoverOptions<D> = Pick<
  PopoverState<D>, 'props' | 'model' | 'rules' | 'listeners' | 'scopedSlots' | 'render'
>

const prevent = (e: Event) => e.preventDefault()
const getForm = (root: Vue): ElForm | null => findDownward(root, 'ElForm') as ElForm

@Component
class Popover<D extends {}> extends Vue {

  /**
   * Provide a static helper for creating Popover component instances programmatically
   *
   * @param reference {Element|Node}
   * @param options {PopoverOptions}
   */
  static create <D = any> (
    reference: { nodeType: number; nodeName: string; popoverVm: any }, // duck-like
    options: Partial<PopoverOptions<D>>
  ): Popover<D> {
    if (reference.popoverVm) {
      return reference.popoverVm
    }

    const vm = new Popover<D>({
      propsData: {},
      data () {
        return {
          reference,
          ...options
        }
      }
    })

    vm.$mount(document.body.appendChild(document.createElement('span')))
    reference.popoverVm = vm

    return vm
  }
  data (): Partial<PopoverState<D>> {
    return {
      form: null,
      skipValidator: false,
      visible: false,
      model: {} as D,
      rules: null,
      props: {},
      listeners: {},
      reference: null,
      scopedSlots: {}
    }
  }

  render (h: CreateElement, ...args: any[]): VNode {
    const { reference, props, model, rules, scopedSlots } = this

    const propsData = {
      hideOnblur: true,
      placement: 'top',
      width: 240,
      trigger: 'manual',
      reference,
      ...props
    }

    const body = this.render(h, { model, rules })

    // Supports empty fragement
    //  <template>
    //    <h1>title</h1>
    //    <p>description</p>
    //  </template>
    const nodes = body.tag === 'template'
      ? body.children
      : [body]

    return (
      <el-popover v-model={this.visible} props={propsData} on-after-enter={this.afterEnter} on-after-leave={this.afterLeave}>
        { nodes }
        {
          scopedSlots.footer ? scopedSlots.footer(h) : (
            <div class="v-align-right">
              <Button size="mini" onClick={this.handleCancel}>{$t('Cancel')}</Button>
              <Button size="mini" type="primary" onClick={this.handleOK}>{$t('Submit')}</Button>
            </div>
          )
        }
      </el-popover>
    )
  }

  created () {
    this.$on('opened', () => {
      const f = getForm(this)
      let formEl: Element | null
      if (f && (formEl = f.$el)) {
        // native.prevent
        on(formEl, 'submit', prevent)
        this.$on('hook:beforeDestroy', () => off(formEl!, 'submit', prevent))
      }
      this.form = f
    })
    this.$on('hide', () => {
      const el = this.$el
      this.$destroy()
      if (el.parentNode) el.parentNode.removeChild(el)
      this.reference!.popoverVm = null
    })
  }

  mounted () {
    this.$nextTick(() => this.visible = true)
    const listeners = this.listeners
    this.form = findDownward(this, 'ElForm')
    if (listeners) {
      Object.keys(listeners).forEach((k) => {
        const fn = listeners[k]
        if (fn && isFunction(fn)) {
          this.$on(k, (e: Event, cb: ICallback) => {
            // pass data to event source
            e.data = this.model
            const r: any = fn.call(this, e)
            if (isPromise(r)) {
              r.then((a: any) => cb(null, a), cb)
            } else {
              this.$nextTick(() => cb(null))
            }
          })
        }
      })
    }
  }

  afterEnter () {
    this.$emit('opened')
  }

  afterLeave () {
    this.$emit('hide')
  }

  validate (): Promise<boolean> {
    return this.form ? this.form!.validate() : true
  }

  async handleOK (e: Event) {
    const f = this.form!

    if (!this.skipValidator && f && f!.rules) {
      let valid = false
      try {
        valid = await this.validate()
      } catch (e) {}
      if (!valid) {
        return true
      }
    }

    return new Promise((resolve, reject) => this.$emit('submit', e, (err: Error, data: any) => {
      if (!err) {
        this.visible = false
      }
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    }))
  }

  handleCancel () {
    this.visible = false
    this.$emit('cancel')
  }
}

export { Popover }
