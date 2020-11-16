import { ElDialog } from 'element-ui/types/dialog'
import { ElForm } from 'element-ui/types/form'
import { CreateElement } from 'vue'
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'

import { findDownward, reactSet } from '@/utils/vue'
import { $t } from '@tdio/locale'
import { deepClone } from '@tdio/utils'

import MixinDialog from './MixinDialog'

import { Button } from '../../Button'

const getForm = (root: Vue): ElForm | null => findDownward(root, 'ElForm') as ElForm

@Component
export default class AbsFormDialog extends MixinDialog {
  @Prop(String)
  width!: string

  @Prop(String)
  size!: string

  @Prop({ type: Boolean, default: false })
  appendToBody!: boolean

  @Prop(String)
  dialogClass!: string

  // For skip builtin validator
  @Prop(Boolean)
  skipValidator!: boolean

  isShow: boolean = false
  form: ElForm | null = null

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
      this.form!.resetFields()

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
      entity
    } = this

    const dlgClassNames = [
      dialogClass,
      size ? `v-dialog--${size}` : ''
    ].filter(Boolean)


    const isVisible = this.inited && this.isShow

    return (
      <el-dialog
        ref="dlg"
        class={[{ [className]: !!className }, 'v-form-dlg']}
        customClass={dlgClassNames.join(' ')}
        visible={entity.visible}
        on={{ 'update:visible': (e: boolean) => entity.visible = e }}
        title={entity.title}
        width={width}
        append-to-body = {appendToBody}
        closeOnClickModal={false}
        on-close={() => this.$emit('close')}
        on-closed={() => { this.isShow = false; this.$emit('closed') }}
        on-open={() => { this.isShow = true; this.$emit('show') }}
        on-opened={() => this.$emit('opened')}
      >
        {
          isVisible ? [
            $scopedSlots.default ? $scopedSlots.default({ model: entity.data, rules: entity.rules, $self: entity, $this: this }) : null,
            <template slot="footer">
              {
                $scopedSlots.footer ? $scopedSlots.footer({ $self: entity, $this: this }) : (
                  <div class="dialog-footer">
                    <Button onClick={this.close}>{$t('Cancel')}</Button>
                    <Button type="primary" onClick={this.submit}>{$t('Save')}</Button>
                  </div>
                )
              }
            </template>
          ] : null
        }
      </el-dialog>
    )
  }
}
