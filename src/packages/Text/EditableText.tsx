import { CreateElement, VNode } from 'vue'
import { Component, Emit, Prop, Vue, Watch } from 'vue-property-decorator'

import { get, isArray, isEmpty, isFunction, pick, template } from '@tdio/utils'

import { TooltipOptions, tooltipProps } from '@/utils/normalize'
import { findUpward, isVNode } from '@/utils/vue'

import { IValidateRuleItem, IValidateRuleObject } from '../../../types/validate'

import { Popover, PopoverOptions } from '../Box'
import { Icon } from '../Icon'
import RichText from './RichText'

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
  /* rich-text props (start) */
  @Prop({ type: String, default: 'top' })
  placement!: string

  @Prop({ type: [String, Number], default: -1 })
  truncateLength!: number | string

  @Prop({ type: Boolean, default: false })
  isUnicodeLength!: boolean

  @Prop({ type: [String, Object, Boolean] })
  tooltip!: Partial<TooltipOptions> | string | boolean

  @Prop({ type: String, default: 'v-text' })
  tooltipClass!: string
  /* rich-text props (end) */

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

  render (h: CreateElement) {
    const {
      value,
      editable,
      $slots,
      editorClass,
      showEditIcon,
      emptyText
    } = this

    const textProps = pick(this.$props, ['placement', 'truncateLength', 'isUnicodeLength', 'tooltip', 'tooltipClass'])
    const viText = this.getViText()
    const textStr = value || (typeof viText === 'string' ? viText as string : '') || ''

    return (
      <span class="v-editable">
        {
          editable ? (
            [
              $slots.editor
                ? $slots.editor
                : (<el-input value={textStr} class={{ [editorClass]: !!editorClass }} props={this.$attrs} on={this.$listeners} clearable />),
              $slots['editor-suffix']
                ? $slots['editor-suffix']
                : null
            ]
          ) : (
            [
              isVNode(viText)
                ? viText
                : textStr && (<RichText props={textProps}>{textStr}</RichText>) || emptyText,
              showEditIcon
                ? <Icon icon-name="el-icon-edit-outline" class="v-icon-modify" onClick={ (e: Event) => this.showModifyPop(textStr, e) } tooltip={$t('Modify')} light={true} />
                : null
            ]
          )
        }
      </span>
    )
  }

  private getViText (): string | VNode[] | VNode {
    const {
      value,
      $slots
    } = this
    let str = ''
    let slot: VNode | VNode[] | undefined
    if ((slot = $slots.default || $slots.text)) {
      // it's a default slot (plain text)
      if (isArray(slot)) {
        str = get(slot, '[0].text', '')!.trim()
      }
    }
    return str || slot || value
  }

  private showModifyPop (text: string, e: Event) {
    const { rules = [], prop, label } = this.getFieldScheme()
    const {
      $slots,
      $scopedSlots
    } = this
    const editorSlot = $scopedSlots.editor || $slots.editor
    return Popover.create<D>(e.currentTarget as Node, {
      props: {
        title: label,
        popperClass: 'v-editable__popover'
      },
      model: { text },
      rules: { text: rules },
      render: (
        h: CreateElement,
        { model, rules }: { model: D; rules?: IValidateRuleObject; }
      ) => (
        <el-form class="v-form" props={{ model, rules, statusIcon: false }}>
          <el-form-item prop="text" showMessage={false}>
            {
              editorSlot
                ? (isFunction(editorSlot) ? (editorSlot as Function)(model) : editorSlot)
                : (<el-input v-model={ model.text } props={ this.$attrs }>
                   { $slots['editor-suffix'] ? <template slot="suffix">{ $slots['editor-suffix'] }</template> : null }
                </el-input>)
            }
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
      ...this.fieldScheme
    }
  }

}
