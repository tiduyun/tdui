import { CreateElement } from 'vue'
import { Component, Mixins, Prop, Vue, Watch } from 'vue-property-decorator'

import { debounce } from '@/utils/decorators'
import { constant, isArray, isEmpty, isFunction, isObject, isPromise, valueEquals } from '@tdio/utils'

import Select from './Select'

const values = (o: any) => (isObject(o) ? Object.values(o) : o)
const isValueEquals = (o: any, p: any) => valueEquals(values(o), values(p))

type IOptionEntity = any // object
type IOptionsLoader = (...args: any[]) => Promise<IOptionEntity[]> | IOptionEntity[]
type OptionsImpl = IOptionEntity | IOptionsLoader

@Component
class MixinSelect extends Vue {
  /** @abstract */
  keys: string = ''
  props: Kv = {}

  propLabel: string = 'label'
  propValue: string = 'value'

  @Prop()
  value!: any

  @Prop()
  entity!: IOptionEntity

  @Prop({ type: Function, default: constant(true) })
  optionsFilter!: (o: IOptionEntity) => boolean

  @Prop(Boolean)
  loading!: boolean

  lock: boolean = this.loading
  items: IOptionEntity[] = []

  private _inited?: boolean // duplicate initialize fetching locker
  private _pending?: IOptionsLoader

  initOptions <T> (options: OptionsImpl, p?: OptionsImpl) {
    const { keys } = this
    const v = options

    if (isFunction(v)) {
      const f: IOptionsLoader = (v as IOptionsLoader).bind(this)
      if (this.lock) {
        this._pending = f
        return
      }

      this.setLoading(true)

      const handleCb = (err: Error | null, r?: IOptionEntity[]) => {
        if (!err) {
          if (!isEmpty(keys)) {
            this._inited = true
          }
          this.setOptions(r || [])
        }
        this.setLoading(false)
        const pending = this._pending
        if (pending) {
          this._pending = undefined
          if (!isValueEquals(keys, this.keys)) {
            this.initOptions(pending)
          }
        }
      }

      const r = f(keys)
      if (isPromise(r)) {
        (r as Promise<IOptionEntity[]>).then(
          arr => handleCb(null, arr),
          err => handleCb(err)
        )
      } else {
        handleCb(null, r as IOptionEntity[])
      }

    } else if (v !== this.items) {
      this.setOptions(v as IOptionEntity[])
    }
  }

  /**
   * API for retrieve select options.
   */
  load () {
    this.initOptions(this.options)
  }

  mounted () {
    this.load()
    // Add a watcher to assert auto reload options
    this.$watch('keys', (v: string | Kv, p: string | Kv) => {
      if (!isEmpty(p) && this._inited && isValueEquals(v, p)) return
      this.load()
    })
    this.$watch('options', () => {
      this.load()
    })
  }

  render () {
    const { $slots, $scopedSlots } = this
    const {
      value,
      items: options,
      $attrs: attrs,
    } = this
    const children = Object.keys($slots).map(slot => <template slot={slot}>{ $slots[slot] }</template>)
    return (
      <Select
        {
          ...{
            attrs: {
              ...this.props,
              ...attrs,
              inputLoading: this.lock
            }
          }
        }
        options={options}
        propLabel={this.propLabel}
        propValue={this.propValue}
        value={value}
        entity={this.entity}
        on={this.$listeners}
        slots={$slots}
        scopedSlots={$scopedSlots}
      >
        { children }
      </Select>
    )
  }

  private setLoading (v: boolean): void {
    this.lock = v
    this.$emit('update:loading', v)
  }

  private setOptions (items: IOptionEntity[]): void {
    items = isArray(items) ? items : []
    this.items = items.filter(this.optionsFilter)
  }
}

export default Mixins<MixinSelect>(MixinSelect)
