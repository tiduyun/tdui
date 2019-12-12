import { CreateElement } from 'vue'
import { Component, Emit, Prop, Vue, Watch } from 'vue-property-decorator'

import { isEmpty } from '@tdio/utils'

import { findUpward } from '@/utils/vue'

import { IValidateRuleItem, IValidateRuleObject } from '../../../types/validate'

import { Popover, PopoverOptions } from '../Box'
import { Icon } from '../Icon'

import './EditableText.scss'

type FieldScheme = Kv & {
  prop?: string;
  label?: string;
  value?: any;
  rules?: IValidateRuleItem[];
}

interface D extends Kv {
  text: string | null;
}

@Component
export default class EditableText extends Vue {
  @Prop({ type: Boolean, default: true })
  editable!: boolean

  /* @deprecated Use <Label /> instead if not editable */
  @Prop({ type: Boolean, default: true })
  showEditIcon!: boolean

  @Prop({ type: [String, Number], default: '' })
  value!: any

  @Prop({ type: String, default: '-' })
  emptyText!: string

  @Prop({ type: String, default: '' })
  editorClass!: string

  @Prop({ type: Object, default: () => ({}) })
  fieldScheme!: FieldScheme

  @Prop({ type: Function, default: () => {} })
  onSubmit!: (prop: string, value: string) => Promise<any>

  private currentValue: string | null = null

  @Watch('value', { immediate: true })
  setCurrentValue (newVal: any, oldVal: any) {
    if (newVal !== oldVal) {
      this.currentValue = newVal
    }
  }

  render (h: CreateElement) {
    const {
      editable,
      $slots,
      currentValue,
      editorClass,
      emptyText,
      showEditIcon
    } = this

    return (
      <span class="v-editable">
        {
          editable ? (
            [
              $slots.editor ? $slots.editor : (<el-input value={currentValue} class={{ [editorClass]: !!editorClass }} props={this.$attrs} on={this.$listeners} clearable />),
              $slots['editor-suffix'] ? $slots['editor-suffix'] : null
            ]
          ) : (
            [
              <span name="text">{ isEmpty(currentValue) ? emptyText : currentValue }</span>,
              showEditIcon ? <Icon icon-name="el-icon-edit-outline" class="v-icon-modify" onclick={this.showModifyPop} tooltip={$t('Modify')} light={true} /> : null
            ]
          )
        }
      </span>
    )
  }

  private showModifyPop (e: Event) {
    const { rules = [], prop, label } = this.getFieldScheme()
    return Popover.create<D>(e.currentTarget as Node, {
      props: {
        title: label,
        popperClass: 'v-editable__popover'
      },
      model: { text: this.currentValue },
      rules: { text: rules },
      render: (
        h: CreateElement,
        { model, rules }: { model: D; rules?: IValidateRuleObject; }
      ) => (
        <el-form class="v-form" props={{ model, rules, statusIcon: true }}>
          <el-form-item prop="text" showMessage={false}>
            <el-input v-model={ model.text } props={ this.$attrs } />
          </el-form-item>
        </el-form>
      ),
      listeners: {
        submit: (e: Event) => this.onSubmit(prop!, e.data!.text)
      }
    })
  }

  private getFieldScheme (): FieldScheme {
    const formItem = findUpward(this, 'ElFormItem')
    let formProps = {}
    if (formItem) {
      const { label, rules, prop } = formItem
      formProps = { label, rules, prop }
    }
    return {
      ...formProps,
      ...this.fieldScheme,
      value: this.currentValue
    }
  }

}
