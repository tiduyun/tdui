import { ElPopover } from 'element-ui/types/popover'
import { ElTree, TreeData, TreeNode } from 'element-ui/types/tree'
import { Component, Prop, Ref, Vue, Watch } from 'vue-property-decorator'

import { contains, off, on } from '@tdio/dom-utils'
import { $t } from '@tdio/locale'
import { defaultTo, get, hasOwn, isArray, isEqual, isValue, memoize, merge, noop, omit, valueEquals } from '@tdio/utils'

import { debounce as Debounce } from '@/utils/decorators'
import { Emittable } from '@/utils/emittable'

import { IOption, Many, Nil } from '../../types/common'

import { DisplayValuesChangeInfo, Selector } from './Selector'
import './TreeSelect.scss'

declare module 'element-ui/types/tree' {
  interface ElTree <K, D> {
    setCurrentKey (key: K | undefined): void;
  }
  interface TreeStore<K, D> {
    getCurrentNode (): TreeNode<K, D>;
    setCurrentNode (): void;
    getNode (data: D | K): TreeNode<K, D> | null;
  }
  interface TreeData {
    [p: string]: any;
  }
}

declare module 'element-ui/types/popover' {
  interface ElPopover {
    updatePopper (): void;
  }
}

interface ITreeData extends TreeData {}

export interface TreeParams<K, D extends ITreeData> extends Kv {
  cacheKey: number;
  clickParent?: boolean;
  data?: D[];
  currentNodeKey?: K;
  highlightCurrent?: boolean;
  expandOnClickNode?: boolean;
  defaultExpandedKeys?: Array<string | number>;
  defaultCheckedKeys?: K[];
  props: {
    children: string;
    label: string;
    value: string;
    disabled: string;
  }
}

interface TreeCheckEventArgs<K, D> {
  checkedNodes: D[]; // @see element-ui/packages/tree/store/getCheckedNodes()
  checkedKeys: K[];
  halfCheckedNodes: D[];
  halfCheckedKeys: K[];
}

const normalizeCssWidth = (n: string | number): string => {
  const s = String(n)
  return (/^\d+$/.test(s) ? `${s}px` : s)
}

function ensureArray <T> (n: Many<T> | Nil): T[] {
  return (isArray(n) ? n : isValue(n) ? [n] : [])
}

function getBusterKey <T> (o: T[]): string {
  return o.join(',')
}

const getVuePropDefault = (o: Vue, prop: string) => {
  const p = get(o, `constructor.extendOptions.props.${prop}`)
  return p ? p.default() : undefined
}

interface TreeSelectState<K, D> {
  popperWidth: number;
  visible: boolean; // popover v-model

  /* @deprecated select params */
  select: Kv;

  // tree
  tree: TreeParams<K, D>;
  query: string;
  ids: K[];
  selectedValues: IOption[];

  // internal entity state
  ready: boolean;
  entityKey: string;
  lastEntity: D[];
}

const deprecated = memoize(
  (deprecatedKey: string, alt = '') => console.warn(`<TreeSelect /> [${deprecatedKey}] is deprecated. ${alt}`)
)

@Component({
  componentName: 'TreeSelect',
  inheritAttrs: false
})
@Emittable
export default class TreeSelect <K = string | number, D extends ITreeData = ITreeData> extends Vue {
  @Prop({ default: undefined })
  value!: Many<K> | Nil

  @Prop({ type: String, default: 'bottom' })
  placement!: string

  @Prop({ type: Boolean, default: false })
  disabled!: boolean

  @Prop({ type: [Number, String] })
  width!: number

  @Prop({ type: Object, default: () => ({}) })
  styles!: Kv

  @Prop(Boolean)
  defaultFirstOption!: boolean

  @Prop(Boolean)
  accordion!: boolean

  @Prop(Boolean)
  multiple!: boolean

  @Prop(Boolean)
  filterable!: boolean

  @Prop({ type: Boolean, default: true })
  clearable!: boolean

  @Prop({ type: String, default: $t('Select...') })
  placeholder!: string

  @Prop({ type: String, default: 'v-treeselect' })
  prefixCls!: string

  @Prop(Array)
  data!: D[] | null

  @Prop(Object)
  selectParams!: Kv

  @Prop(Boolean)
  loading!: boolean

  @Prop({
    type: Object,
    default: () => ({
      cacheKey: Date.now(),
      clickParent: true,
      props: {
        children: 'children',
        label: 'name',
        value: 'value',
        disabled: 'disabled'
      }
    })
  })
  treeParams!: TreeParams<K, D>

  // internal state
  state: TreeSelectState<K, D> = {
    popperWidth: this.width || 150,
    visible: false,
    ids: [],  // K[] selected id list (indexes), should be synced with model value
    selectedValues: [], // selected items IOption[]
    query: '',
    tree: this.treeParams,
    select: this.selectParams,
    ready: false,
    entityKey: '',
    lastEntity: []
  }

  @Ref('tree')
  $tree!: ElTree<K, D>

  @Ref('popover')
  $popover!: ElPopover

  @Watch('value')
  watchValue (val: Many<K> | Nil, oldVal: Many<K>) {
    if (!this.state.ready || valueEquals(val, oldVal)) {
      return
    }
    const ids: K[] = ensureArray(val)
    if (!valueEquals(this.state.ids, ids)) {
      this.setCurrentIds(ids, true)
    }
    this.dispatch('ElFormItem', 'el.form.change', val)
  }

  @Watch('selectParams', { immediate: true })
  initSelectParams (o: Kv) {
    const deprecatedProps: Kv<0 | string> = { multiple: 0, clearable: 0, disabled: 0, placeholder: 0, inputLoading: 'loading' }
    const selectParams = merge({}, this.state.select, omit(o, Object.keys(deprecatedProps)))
    this.setState({ select: selectParams })
    for (const k in deprecatedProps) {
      if (hasOwn(o, k)) {
        const altKey = deprecatedProps[k] || k
        this.$setState(altKey, o[k])
        deprecated(`#selectParams.${k}`, altKey !== k ? `Use [#${altKey}] instead` : '')
      }
    }
  }

  @Watch('treeParams', { immediate: true })
  initTreeParams (v: TreeParams<K, D>) {
    const { data, filterable, ...rest } = v

    // rebuild tree if meta changed
    if (rest.props) {
      rest.cacheKey = Date.now()
    }

    // adaptor treeSelect.filterable with #.filterable
    if (filterable !== undefined) {
      deprecated('#treeParams.filterable')
      this.$setState('filterable', filterable)
    }

    this.setState({
      tree: merge({}, getVuePropDefault(this, 'treeParams'), rest)
    })

    if (isArray(data)) {
      deprecated('#treeParams.data')
      this.$setState('data', data)
    }
  }

  @Watch('data', { immediate: true })
  handleDataInitial (data: D, prev: D) {
    if (isArray(data) && !this.state.ready) {
      this.setState({ ready: true })
      this.nextTick(() => this.$emit('ready'))
    }
  }

  setState (state: Partial<TreeSelectState<K, D>>) {
    Object.keys(state).forEach((k) => {
      this.$set(this.state, k, state[k as keyof TreeSelectState<K, D>])
    })
  }

  getState <T> (type: string): T {
    return get<T>(this.state, type)!
  }

  created () {
    this.$once('ready', () => {
      const { tree } = this.state
      const data: D[] = this.data || []
      let ids = ensureArray(this.value)

      let silent = true

      // sync internal ids state, optional select the first item for single-mode
      if (!this.multiple && this.defaultFirstOption && ids.length === 0 && data.length > 0) {
        const firstKey = get(data[0], tree.props.value)
        ids = [firstKey]
        // emit if value changed
        silent = firstKey === this.value
      }

      this.setCurrentIds(ids, silent)
    })

    this.$on('collapse', () => {
      this.handleTreeFilter('')
    })
  }

  mounted () {
    const elem = (this.$refs.select as Vue)!.$el as HTMLElement
    if (elem) {
      const popperWidth = elem.offsetWidth
      this.setState({ popperWidth })
    }
    this.nextTick(() => this.initClickOutside())
  }

  render () {
    const {
      $scopedSlots,
      data,
      state,
      multiple,
      disabled,
      clearable,
      placeholder,
      prefixCls,
      loading
    } = this

    const {
      popperWidth,
      tree: treeState,
      select: selectState,
    } = state

    const selectProps = {
      placeholder,
      disabled,
      clearable,
      loading,
      ...selectState
    }

    const treeProps = {
      ...treeState,
      nodeKey: treeState.props.value,
      draggable: false,
      showCheckbox: multiple,
      checkOnClickNode: multiple,
      filterNodeMethod: this.filterNodeMethod,
      data,
      accordion: this.accordion
    }

    if (multiple) {
      treeProps.defaultCheckedKeys = state.ids
      treeProps.highlightCurrent = defaultTo(treeState.highlightCurrent, false)
    } else {
      treeProps.currentNodeKey = state.ids[0]
      treeProps.highlightCurrent = defaultTo(treeState.highlightCurrent, true)
    }

    // prevent expand child when parent selectable
    if (treeProps.clickParent) {
      treeProps.expandOnClickNode = false
    }

    const handleTreeCreated = () => {
      // disable tree set current node
      if (this.multiple) {
        this.$tree.store.setCurrentNode = noop
      }
    }

    const transitionName = 'el-zoom-in-top'
    const isEmptyData = !data || data.length === 0

    return (
      <div class={prefixCls} style={{ ...this.styles, width: normalizeCssWidth(this.width) }}>
        <el-popover
          ref="popover"
          v-model={state.visible}
          placement={this.placement}
          popperClass={[`${prefixCls}__popper`, disabled ? 'disabled' : ''].filter(Boolean).join(' ')}
          width={popperWidth}
          trigger="manual"
          transition={transitionName}
        >
          <Selector
            ref="select"
            slot="reference"
            prefixCls={`${prefixCls}__selector`}
            mode={multiple ? 'multiple' : undefined}
            displayValues={state.selectedValues}
            attrs={selectProps}
            open={state.visible}
            onToggleOpen={this.togglePopper}
            onDisplayValuesChange={this.handleDisplayValuesChange}
            onVisualUpdated={() => { if (multiple && state.visible) this.updatePopper() }}
            getPlaceContainer={$scopedSlots.selector}
          />
          {this.filterable && (
            <div class="filter-box">
              <el-input value={state.query} onInput={this.handleTreeFilter} size="mini" prefixIcon="el-icon-search" clearable={true} validateEvent={false} />
            </div>
          )}
          <el-scrollbar key="tree" tag="div" wrapClass="el-select-dropdown__wrap" viewClass="el-select-dropdown__list">
            <el-tree
              ref="tree"
              v-show={!isEmptyData}
              key={state.tree.cacheKey}
              props={treeProps}
              on={{
                check: this.handleTreeCheck,
                'node-click': this.handleTreeNodeClick,
                'hook:mounted': handleTreeCreated
              }}
              {
                ...{
                  scopedSlots: {
                    default: (item: any) => (<span class="el-tree-node__label" title={item.node.label}>{item.node.label}</span>)
                  }
                }
              }
            />
            {isEmptyData && (<div class="el-select-dropdown__empty">{$t('No Data')}</div>)}
          </el-scrollbar>
        </el-popover>
      </div>
    )
  }

  @Debounce(200)
  handleTreeFilter (q: string) {
    if (this.state.query === q) {
      return
    }
    this.$tree.filter(q)
    this.setState({ query: q })
    this.$emit('search', q)
  }

  getCurrentNode (): TreeNode<K, D> | null {
    return this.$tree?.store?.getCurrentNode() || null
  }

  /**
   * Get tree node by purge data
   */
  getNode (data: K | D): TreeNode<K, D> | null {
    return this.$tree?.store?.getNode(data) || null
  }

  // @see element-ui/types/tree#ElTree.filterNodeMethod
  filterNodeMethod (q: string, data: D, node: TreeNode<K, D>): boolean {
    if (!q) return true
    return node.label.indexOf(q) !== -1
  }

  handleTreeNodeClick (data: D, node: TreeNode<K, D>, vm: ElTree<K, D>) {
    // emit model when single-select mode
    if (!node.disabled && !this.multiple) {
      const { clickParent, props } = this.state.tree
      const childrenProp = props.children

      let ids: K[] = []
      const nodeValue = node.key

      if (!clickParent) {
        const children = data[childrenProp]
        if (!children || children.length === 0) {
          ids = [nodeValue]
          this.hidePopper()
        } else {
          return
        }
      } else {
        ids = [nodeValue]
        this.hidePopper()
      }

      this.setCurrentIds(ids)
    }

    // through node-click event
    this.$emit('node-click', data, node, vm)
  }

  handleTreeCheck (data: D, args: TreeCheckEventArgs<K, D>) {
    const ids = this.$tree.getCheckedKeys()
    this.$emit('check', data, args)
    this.setCurrentIds(ids)
  }

  handleDisplayValuesChange (values: IOption[], info: DisplayValuesChangeInfo) {
    this.setCurrentIds(values.map(o => o.value))
  }

  handleSelectClear () {
    this.setCurrentIds([])
    this.$emit('clear')
  }

  updatePopper () {
    this.$popover.updatePopper()
  }

  hidePopper (trigger: boolean = true) {
    this.setState({ visible: false })
    this.$emit('collapse')
  }

  showPopper () {
    this.setState({ visible: true })
    this.$emit('expand')
  }

  togglePopper (visible: boolean) {
    if (visible) {
      this.showPopper()
    } else {
      this.hidePopper(false)
    }
  }

  /**
   * Set checked nodes by keys (for multiple mode)
   */
  setCheckedKeys (keys: K[]) {
    const tr = this.$tree
    if (tr) {
      tr.setCheckedKeys(keys)
    }
  }

  /**
   * Set current node by primary key
   */
  setCurrentKey (key: K) {
    const tr = this.$tree
    if (tr) {
      tr.setCurrentKey(key)
    }
  }

  /**
   * Set current value (internal: state.ids), also may conditional emit models
   *
   * @param values {K[]} The current selected value
   * @param silent {Boolean} skip model emit (input & change events)
   */
  setCurrentIds (values: K[], silent?: boolean) {
    const { multiple, value } = this

    if (this.state.ids !== values) {
      this.state.ids = values
      if (multiple) {
        this.setCheckedKeys(values)
      } else {
        this.setCurrentKey(values[0])
      }
    }

    const v = multiple
      ? values
      : values.length > 0 ? values[0] : undefined

    // check value is changed indeed, null, undefined, shadow clones array are ignored
    if (!(v == null && value == null || valueEquals(value, v))) {
      if (!silent) {
        this.$emit('input', v)
        this.$emit('change', v, value)
      }
      if (!multiple) {
        this.$emit('select-node', this.getCurrentNode())
      }
    }

    if (this.state.ready) {
      this.setState({
        selectedValues: this.state.ids.reduce<IOption[]>((vals, k) => {
          const n = this.getNode(k)
          if (n) {
            vals.push({
              label: n.label,
              value: n.key,
              disabled: n.disabled
            })
          }
          return vals
        }, [])
      })

      // emit select entities
      this.syncEntity()
    }
  }

  private syncEntity () {
    const entity = this.state.ids.map(id => this.getNode(id)?.data)
    const { lastEntity, entityKey } = this.state

    // calc identity entity changes buster based on current value
    const key = getBusterKey(this.state.ids.sort())
    if (entityKey !== key && !valueEquals(lastEntity, entity)) {
      Object.assign(this.state, { lastEntity: entity, entityKey: key })
      const v = this.multiple ? entity : entity[0]
      this.$emit('entity', v)
      this.$emit('update:entity', v)
    }
  }

  private nextTick (fn: () => void) {
    this.$nextTick(() => { if (!this._isDestroyed) fn() })
  }

  private initClickOutside () {
    const handleClick = (e: Event) => {
      const sender = e.target as Element
      const isInter = [this.$el, this.$popover.popperElm].some(c => contains(c, sender))
      if (!isInter && this.state.visible) {
        this.hidePopper()
      }
    }

    const releaseEvents = ['collapse', 'hook:beforeDestroy']
    let teardown = noop

    // bind out side click handle lazy
    this.$on('expand', () => {
      teardown()

      teardown = () => {
        off(document, 'mouseup', handleClick)
        this.$off(releaseEvents, teardown)
        teardown = noop
      }

      on(document, 'mouseup', handleClick)
      this.$once(releaseEvents, teardown)
    })
  }
}
