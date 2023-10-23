import { functionalComponent } from '@tdio/vue-utils'
import { CreateElement } from 'vue'

import { IOption } from '../../types/common'

/**
 * ```jsx
 *  <ComponentBuilder
 *    component="CheckboxGroup"
 *    v-model="checkbox"
 *    :options="[{ label: 't1', value: 'v1' }, { label: 't2', value: 'v2' }]"
 *  />
 * ```
 */
export const CheckboxGroup = functionalComponent((h: CreateElement, { options, ...props }) =>
  (<el-checkbox-group {...props}>{options.map((o: IOption) => <el-checkbox key={o.value} label={o.value}>{o.label}</el-checkbox>)}</el-checkbox-group >)
)
