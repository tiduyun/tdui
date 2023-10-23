import { $t } from '@tdio/locale'
import { isObject, isValue } from '@tdio/utils'
import { ElSelect } from 'element-ui/types/select'
import { Component, Mixins, Prop, Ref, Watch } from 'vue-property-decorator'

import { extractTooltip } from '../../utils/normalize'

import { IOption } from '../../types/common'
import { Icon } from '../Icon'

import { AbsSelectView } from './AbsSelectView'
import './Select.scss'

/**
 * scoped-slots: options, option
 * events: ['toggleOpen', 'input', 'change', 'entity']
 *
 * ```
 * <Select>
 *   <template #options="items">
 *     <el-option-group v-for="group in items" :key="group.label" :label="group.label">
 *       <el-option v-for="item in group.options" :key="item.value" :label="item.label" :value="item.value" />
 *     </el-option-group>
 *   </template>
 *   <template #opttion="option">{{option.lable}}</template>
 * </Select>
 * ```
 */

@Component({
  name: 'Select',
  inheritAttrs: false
})
export default class Select extends Mixins(AbsSelectView) {
  @Prop({ type: Boolean, default: false })
  clearable!: boolean

  @Prop({ type: String, default: $t('Select...') })
  placeholder!: string

  @Prop({ type: Boolean, default: null })
  disabled!: boolean

  @Prop()
  tooltip!: string | {}

  @Prop({ type: Boolean })
  open!: boolean

  @Ref('select')
  $select!: ElSelect

  /**
   * Abstract property set for the derived component overrides
   * @abstract
   */
  selectProps: Kv = {}

  @Watch('open')
  watchVisiable (v: boolean) {
    this.$select.visible = v
  }

  render () {
    const {
      $slots,
      $scopedSlots,
      $props,
      $attrs,
      disabled,
      placeholder,
      clearable,
      multiple,
      prefixCls,
      selectProps
    } = this

    const calcDisabled = isValue(disabled) ? disabled : false

    const renderOption = (o: IOption, _entity: any) => {
      const { tooltip, icon } = o
      const hasIcon = !!icon
      const tipContent = tooltip || ''
      const hasTip = !!tipContent
      const optionTip = hasTip
        ? isObject(tooltip) ? tooltip : { content: tooltip }
        : null
      return (
        <el-option key={o.value} props={o} title={o.label} class={{'has-icon': hasIcon, 'has-tip': hasTip}}>
          <span class="option-label">
            { hasIcon ? <Icon iconName={icon} /> : null }
            { o.label }
          </span>
          { hasTip ? <Icon className="option-tip fr" iconName="td-icon-info-circle" tooltip={{ placement: 'right', popperStyle: { maxWidth: '300px' }, ...optionTip }} /> : null }
        </el-option>
      )
    }

    // merge <el-select props />
    const props: Kv = {
      popperClass: this.popperClass,
      ...$attrs,
      ...selectProps,
      class: prefixCls,
      reserveKeyword: true,
      disabled: calcDisabled,
      clearable,
      multiple,
      placeholder
    }

    props.popperClass = `${prefixCls}__popper ${props.popperClass || ''}`.trim()

    // Prevent show the plain value when options is a await loader
    const selValue = props.inputLoading
      ? (multiple ? [] : undefined)
      : this.currentValue

    const selectNode = (
      <el-select
        ref="select"
        value={selValue}
        props={props}
        onInput={this.handleSelect}
        on-visible-change={this.handleVisiableChange}
        on-clear={this.handleSelectClear}
        on-remove-tag={this.handleSelectRemove}
      >
        { $slots.prefix ? (<template slot="prefix">{ $slots.prefix }</template>) : null }
        { $slots.suffix ? (<template slot="suffix">{ $slots.suffix }</template>) : null }
        {
          $slots.default
            ? $slots.default
            : $scopedSlots.options
              ? $scopedSlots.options(this.currentOptions)
              : this.currentOptions.map(o => {
                const entity = this.getEntity(o.value)
                return (
                  $scopedSlots.option
                    ? $scopedSlots.option({ ...o, entity })
                    : renderOption(o, entity))
              })
        }
      </el-select>
    )

    const tooltip = extractTooltip({ ...this.$props, ...this.$attr })
    return tooltip && tooltip.content
      ? (<el-tooltip props={tooltip}>{ selectNode }</el-tooltip>)
      : selectNode
  }

  handleVisiableChange (v: boolean) {
    if (this.open !== v) {
      this.$emit('toggleOpen', v)
    }
  }

  handleSelectClear () {
    this.$emit('clear')
  }

  handleSelectRemove <T> (val: T) {
    this.$emit('removeValue', val)
  }
}
