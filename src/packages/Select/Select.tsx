import { Component, Mixins, Prop, Watch } from 'vue-property-decorator'

import { $t } from '@tdio/locale'
import { isValue } from '@tdio/utils'

import { extractTooltip } from '@/utils/normalize'

import { IOption } from '../../types/common'
import { Icon } from '../Icon'

import { AbsSelectView } from './AbsSelectView'
import './Select.scss'

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

    const renderOption = (o: IOption, entity: any) => (
      entity?.icon
        ? (
          <el-option key={o.value} props={o} class="icon-option">
            <Icon iconName={entity.icon} />
            <span>{o.label}</span>
          </el-option>
        ) : (
          <el-option key={o.value} props={o} />
        )
    )

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
    const selValue = props.inputLoading ? undefined : this.currentValue

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
