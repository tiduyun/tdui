
import { constant, isArray, isEmpty, isFunction, isObject, isPromise, keys, valueEquals } from '@tdio/utils'
import { Component, Mixins, Prop, Ref, Vue } from 'vue-property-decorator'

import { parseProps } from '../../utils/vue/parseProps'

import { IOptionEntity, OptionsProvider } from './AbsSelectView'
import { AsyncSelect } from './AsyncSelect'

const values = (o: any) => (isObject(o) ? Object.values(o) : o)
const isValueEquals = (o: any, p: any) => valueEquals(values(o), values(p))

type CacheKey = string | number | object

@Component
class MixinSelect extends Vue {
  /**
   * Fields for sub-component overrides
   * @abstract
   */
  keys: CacheKey = ''
  props: Kv = {}
  propLabel = 'label'
  propValue = 'value'

  /* abstract options: OptionsProvider; */

  @Ref('async-select')
  $sel!: AsyncSelect

  @Prop({ type: Function, default: constant(true) })
  optionsFilter!: (o: IOptionEntity) => boolean

  /**
   * API for retrieve select options.
   */
  load () {
    return this.$sel.load()
  }

  mounted () {
    // Add a watcher to assert auto reload options
    this.$watch('keys', (v: CacheKey, p: CacheKey) => {
      if (!isEmpty(p) && isValueEquals(v, p)) return
      this.load()
    })
  }

  render () {
    const { options, propLabel, propValue, $slots, $scopedSlots } = this
    if (!(isFunction(options) || isArray(options))) {
      throw new Error('The abstract options not implement yet.')
    }

    const parsedProps = parseProps({
      options,
      optionsFilterFunc: this.optionsFilter,
      propLabel,
      propValue,
      ...this.props,
      ...this.$attrs
    }, AsyncSelect)

    return (
      <AsyncSelect
        ref="async-select"
        {...parsedProps}
        on={this.$listeners}
        scopedSlots={$scopedSlots}
      >
        { Object.keys($slots).map(slot => <template slot={slot}>{ $slots[slot] }</template>) }
      </AsyncSelect>
    )
  }
}

export default Mixins<MixinSelect>(MixinSelect)
