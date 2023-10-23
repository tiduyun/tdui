import { isFunction } from '@tdio/utils'
import { cloneVNode, findDownward, parseProps } from '@tdio/vue-utils'
import { VNode } from 'vue'
import { Component, Prop, Vue } from 'vue-property-decorator'

import { IOption, Many, Nil } from '../../types/common'

import Select from './Select'

export interface DisplayValuesChangeInfo {
  type: 'add' | 'remove' | 'clear';
  values: IOption[];
}

const stopEvent = (e: Event) => e.stopPropagation()

@Component
export class Selector extends Vue {
  @Prop(Boolean)
  open!: boolean

  @Prop({ type: Array, default: () => [] })
  displayValues!: IOption[]

  @Prop({ type: String })
  prefixCls!: string

  @Prop(String)
  mode!: 'multiple' | undefined

  @Prop(Function)
  getPlaceContainer!: (displayValues: IOption[]) => VNode[] | undefined // NormalizedScopedSlot<IOption[]>

  @Prop(Boolean)
  loading!: boolean

  onVisualUpdated () {
    this.$emit('visualUpdated')
  }

  mounted () {
    // watch select visual updates
    const selectDDL = findDownward(this, 'ElSelectDropdown')
    if (selectDDL) {
      selectDDL.$on('updatePopper', () => {
        this.$nextTick(() => this.onVisualUpdated())
      })
    }
  }

  render () {
    const displayValues = this.displayValues
    const isMulti = this.mode === 'multiple'

    const { props, attrs } = parseProps({
      ...this.$attrs,
      prefixCls: `${this.prefixCls}-ctl`,
      filterable: false,
      multiple: isMulti,
      popperAppendToBody: false,
      hideOnClickOutside: false,
      open: this.open,
      inputLoading: this.loading,
      options: displayValues,
      value: isMulti
        ? displayValues.map(o => o.value)
        : displayValues[0]?.value
    }, Select)

    const getPlaceContainer = this.getPlaceContainer
    let placeContainer: VNode | undefined

    if (isFunction(getPlaceContainer)) {
      const children = getPlaceContainer(this.displayValues)
      if (children && children.length === 1) {
        placeContainer = cloneVNode(children[0], {
          class: { 'is-open': this.open }
        })
      }
    }

    const selectNode =
      placeContainer || (
        <Select
          attrs={attrs}
          props={props}
          onClear={this.handleSelectClear}
          onRemoveValue={this.handleSelectRemove}
          onToggleOpen={this.onToggleOpen}
          onClick={stopEvent}
        />
      )

    return (
      <div class={this.prefixCls} onClick={this.handleClick}>{selectNode}</div>
    )
  }

  private onToggleOpen (v: boolean) {
    this.$emit('toggleOpen', v)
  }

  private handleClick (e: Event) {
    this.onToggleOpen(!this.open)
  }

  private handleSelectRemove <T> (val: T) {
    const items = this.displayValues.slice()
    let removedDisplayValue = null
    for (let i = items.length - 1; i >= 0; i--) {
      const current = items[i]
      if (current.value === val) {
        items.splice(i, 1)
        removedDisplayValue = current
        break
      }
    }
    if (removedDisplayValue) {
      this.$emit('displayValuesChange', items, {
        type: 'remove',
        values: [ removedDisplayValue ]
      })
    }
  }

  private handleSelectClear () {
    this.$emit('displayValuesChange', [], {
      type: 'clear',
      values: this.displayValues
    })
  }
}
