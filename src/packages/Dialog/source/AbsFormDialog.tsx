import { Dialog, Form } from 'element-ui'
import { Component, Prop, Vue } from 'vue-property-decorator'

import { findDownward, reactSet } from '@/utils/vue'
import { $t } from '@tdio/locale'
import { deepClone } from '@tdio/utils'

import { parseProps } from '../../../utils/vue/parseProps'
import { Button } from '../../Button'

import MixinDialog from './MixinDialog'

const getForm = (root: Vue): Form | null => findDownward(root, 'ElForm') as Form

@Component
export default class AbsFormDialog extends MixinDialog {
  /* Override some props set defaults */

  @Prop(String)
  width!: string

  @Prop(Boolean)
  appendToBody!: boolean

  @Prop(Boolean)
  closeOnClickModal!: boolean

  @Prop(Boolean)
  closeOnPressEscape!: boolean

  @Prop(String)
  customClass!: string

  /* Defines some local props */

  @Prop(String)
  size!: string

  @Prop(String)
  dialogClass!: string

  /**
   * Skip builtin form validator
   */
  @Prop(Boolean)
  skipValidator!: boolean

  @Prop({ type: Boolean, default: true })
  showConfirmButton!: boolean

  @Prop({ type: Boolean, default: true })
  showCancelButton!: boolean

  @Prop({ type: String, default: 'Save' })
  confirmButtonText!: string

  @Prop({ type: String, default: 'Cancel' })
  cancelButtonText!: string

  /* Private data fields */

  isShow: boolean = false
  form: Form | null = null

  validate (): Promise<boolean> {
    const f = this.form
    return f ? f.validate() : Promise.resolve(true)
  }

  async submit (e: Event) {
    if (!this.skipValidator) {
      let valid = false
      try {
        valid = await this.validate()
      } catch (e) {}
      if (!valid) {
        return true
      }
    }
    return new Promise((resolve, reject) => this.$emit('submit', e, (err: Error, data: any) => err ? reject(err) : resolve(data)))
  }

  clearValidate (reset?: boolean) {
    const f = this.form!
    if (f) {
      f.clearValidate()
      if (reset) f.resetFields()
    }
  }

  created () {
    const entity = this.entity
    const initial = deepClone(entity.data)

    this.isShow = entity.visible!

    this.$on('closed', () => {
      const f = this.form!
      if (f) {
        f.resetFields()
      }

      // reset to initialize state
      reactSet(this.entity.data = {}, initial)

      this.$emit('hide')
    })

    this.$on('opened', () => {
      this.form = getForm(this)
    })
  }

  render () {
    const {
      $scopedSlots,
      className,
      dialogClass,
      size,
      width,
      appendToBody,
      entity,
      closeOnClickModal,
      closeOnPressEscape,
      customClass
    } = this

    const isVisible = this.inited && this.isShow

    const parsedProps = parseProps({
      width,
      appendToBody,
      closeOnClickModal,
      closeOnPressEscape,
      customClass: [
        dialogClass,
        customClass,
        size ? `v-dialog--${size}` : ''
      ].filter(Boolean).join(' '),
      ...this.$attrs
    }, Dialog)

    const slotScope = {
      $vm: this,
      $this: this, // to be deprecated
      $self: entity
    }

    const getBodyNode = () => $scopedSlots.default
      ? $scopedSlots.default({
        model: entity.data,
        rules: entity.rules,
        ...slotScope
      })
      : null

    const titleNode = () => $scopedSlots.title
      ? $scopedSlots.title(slotScope)
      : (
        <span class="el-dialog__title">{ entity.title || this.title }</span>
      )

    const footerNode = () => $scopedSlots.footer
      ? $scopedSlots.footer(slotScope)
      : (
        <div class="dialog-footer">
          { this.showCancelButton && (<Button onClick={this.close}>{$t(this.cancelButtonText)}</Button>) }
          { this.showConfirmButton && (<Button type="primary" onClick={this.submit}>{$t(this.confirmButtonText)}</Button>) }
        </div>
      )

    return (
      <el-dialog
        ref="dlg"
        class={[{ [className]: !!className }, 'v-form-dlg']}
        visible={entity.visible}
        on={{ 'update:visible': (e: boolean) => entity.visible = e }}
        {...parsedProps}
        onClose={() => this.$emit('close')}
        onClosed={() => { this.isShow = false; this.$emit('closed') }}
        onOpen={() => { this.isShow = true; this.$emit('show') }}
        onOpened={() => this.$emit('opened')}
      >
        {
          isVisible ? [
            getBodyNode(),
            <template slot="title">{ titleNode() }</template>,
            <template slot="footer">{ footerNode() }</template>
          ] : null
        }
      </el-dialog>
    )
  }
}
