import { CreateElement } from 'vue'
import { Component, Mixins, Prop, Watch } from 'vue-property-decorator'

import { isValue } from '@tdio/utils'

import { tooltipProps } from '@/utils/normalize'

import { IOption } from '../../../types/common'
import { Icon } from '../Icon'

import AbsSelectView from './AbsSelectView'
import './Select.scss'

@Component({
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

  render (h: CreateElement) {
    const { $slots, $scopedSlots, disabled } = this
    const calcDisabled = isValue(disabled) ? disabled : false

    const classPrefix = 'v-select'
    const popperClass = `${classPrefix}--popper ${this.popperClass || ''}`.trim()

    const renderOption = (o: IOption, entity: any) => (
      entity.icon
        ? (
          <el-option key={o.value} label={o.label} value={o.value} class="icon-option">
            <Icon iconName={entity.icon} />
            <span>{o.label}</span>
          </el-option>
        ) : (
          <el-option key={o.value} label={o.label} value={o.value} />
        )
    )

    const selectNode = (
      <el-select
        ref="select"
        class={classPrefix}
        popperClass={popperClass}
        value={this.currentValue}
        reserveKeyword={true}
        clearable={this.clearable}
        disabled={calcDisabled}
        props={this.$attrs}
        placeholder={this.placeholder}
        onInput={this.handleChange}
      >
        { $slots.prefix ? (<template slot="prefix">{ $slots.prefix }</template>) : null }
        { $slots.suffix ? (<template slot="suffix">{ $slots.suffix }</template>) : null }
        {
          $slots.default
            ? $slots.default
            : this.currentOptions.map((o, i) => (
              $scopedSlots.option
                ? $scopedSlots.option({ ...o })
                : renderOption(o, this.options[i])))
        }
      </el-select>
    )

    const tooltip = tooltipProps({ ...this.$props, ...this.$attr })
    return tooltip.content
      ? (<el-tooltip props={tooltip}>{ selectNode }</el-tooltip>)
      : selectNode
  }
}
