import { Component, Mixins, Prop, Watch } from 'vue-property-decorator'

import { $t } from '@tdio/locale'
import { isObject, isValue } from '@tdio/utils'

import { extractTooltip } from '@/utils/normalize'

import { IOption } from '../../types/common'
import { Icon } from '../Icon'

import { AbsSelectView } from './AbsSelectView'
import './Select.scss'

/**
 * scoped-slots: options, option
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

  /**
   * Abstract property set for the derived component overrides
   * @abstract
   */
  selectProps: Kv = {}

  render () {
    const { $slots, $scopedSlots, disabled } = this
    const calcDisabled = isValue(disabled) ? disabled : false

    const classPrefix = 'v-select'
    const popperClass = `${classPrefix}--popper ${this.popperClass || ''}`.trim()

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

    const placeholder = this.placeholder

    const props: Kv = {
      ...this.$attrs,
      ...this.selectProps,
      class: classPrefix,
      popperClass,
      placeholder,
      reserveKeyword: true,
      disabled: calcDisabled,
      clearable: this.clearable,
      multiple: this.multiple,
    }

    // Prevent show the plain value when options is a await loader
    const selValue = props.inputLoading
      ? (this.multiple ? [] : undefined)
      : this.currentValue

    const selectNode = (
      <el-select
        ref="select"
        value={selValue}
        props={props}
        onInput={this.handleSelect}
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
}
