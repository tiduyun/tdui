import { ElPopover } from 'element-ui/types/popover'
import { ElSelect } from 'element-ui/types/select'
import { ElTree, TreeData, TreeNode } from 'element-ui/types/tree'
import { Component, Emit, Prop, Ref, Vue, Watch } from 'vue-property-decorator'

import { $t } from '@tdio/locale'
import { deepAssign, get, isArray, isValue, noop, omit, unset, valueEquals } from '@tdio/utils'

import { Emittable } from '@/utils/emittable'
import { contains, off, on } from '@tdio/dom-utils'

import './TreeSelect.scss'

declare module 'element-ui/types/tree' {
  interface ElTree <K, D> {
    setCurrentKey (key: K | null): void;
  }
  interface TreeStore<K, D> {
    getCurrentNode (): TreeNode<K, D>;
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

type Many<T> = T | ReadonlyArray<T>

interface ITreeData extends TreeData {
}

interface TreeParams<D extends ITreeData> extends Kv {
  clickParent?: boolean;
  filterable: boolean;
  data: D[];
  highlightCurrent: boolean;
  expandOnClickNode?: boolean;
  defaultExpandedKeys?: Array<string | number>;
  props: {
    children: string;
    label: string;
    value: string;
    disabled: string;
  }
}

interface SelectParams extends Kv {
  clearable?: boolean;
}

interface TreeCheckEventArgs<K, D> {
  checkedNodes: D[]; // @see element-ui/packages/tree/store/getCheckedNodes()
  checkedKeys: K[];
  halfCheckedNodes: D[];
  halfCheckedKeys: K[]
}

const normalizeCssWidth = (n: string | number): string => {
  const s = String(n)
  return (/^\d+$/.test(s) ? `${s}px` : s)
}
const ensureArray = (n: any): any[] => (isArray(n) ? n : isValue(n) ? [n] : [])

const getVuePropDefault = (o: Vue, prop: string) => {
  const p = get(o, `constructor.extendOptions.props.${prop}`)
  return p ? p.default() : undefined
}

@Component
@Emittable
export default class TreeSelect <K = string | number, D extends ITreeData = ITreeData> extends Vue {

  @Prop({ default: undefined })
  value!: Many<string | number>

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

  @Prop({ type: Boolean, default: false })
  accordion!: boolean

  @Prop({
    type: Object,
    default: () => ({
      multiple: false,
      clearable: true,
      disabled: false,
      placeholder: $t('Select...')
    })
  })
  selectParams!: SelectParams

  @Prop({
    type: Object,
    default: () => ({
      clickParent: true,
      filterable: false,
      data: [],
      highlightCurrent: true,
      props: {
        children: 'children',
        label: 'name',
        value: 'value',
        disabled: 'disabled'
      }
    })
  })
  treeParams!: TreeParams<D>

  propsValue: string = 'value'
  propsLabel: string = 'name'
  propsDisabled: string = 'disabled'
  propsChildren: string = 'children'

  data: any[] = []
  keywords: string = ''
  labels: string | string[] = '' // aspect for fake select v-model bindings
  ids: K[] = [] // selected option id list (indexes)
  visible: boolean = false // popover v-model

  params: {
    tree: TreeParams<D>,
    select: SelectParams
  } = {
    tree: this.treeParams,
    select: this.selectParams
  }

  state: Kv = {
    width: this.width || 150
  }

  @Ref('tree')
  $tree!: ElTree<K, D>

  @Ref('popover')
  $popover!: ElPopover

  @Ref('select')
  $select!: ElSelect

  @Watch('value')
  watchValue (val: any, oldVal: any) {
    const ids = ensureArray(val)
    if (!valueEquals(this.ids, ids)) {
      this.emitModel(ids)
    }
  }

  @Watch('selectParams', { immediate: true })
  initSelectParams (v: SelectParams) {
    deepAssign(this.params.select, getVuePropDefault(this, 'selectParams'), v)
  }

  @Watch('treeParams', { immediate: true })
  initTreeParams (v: TreeParams<D>) {
    const data = v.data || []
    const treeParams = deepAssign({}, getVuePropDefault(this, 'treeParams'), omit(v, 'data'))
    const { props } = treeParams

    this.params.tree = treeParams
    this.propsValue = props.value
    this.propsLabel = props.label
    this.propsDisabled = props.disabled
    this.propsChildren = props.children

    this.data = data.length > 0 ? [...data] : []

    this.nextTick(() => {
      this.ids = []
      this.labels = this.params.select.multiple ? [] : ''

      if (data.length > 0) {
        // initial the checked item and sync fake select label text
        // optional select the first item
        const ids = (this.defaultFirstOption && data.length)
          ? [data[0]![props.value]]
          : ensureArray(this.value)

        this.emitModel(ids)
      }
    })
  }

  mounted () {
    this.keywords = ''
    this.syncPopperUI()
    this.nextTick(() => this.initClickOutside())
  }

  render () {
    const selectProps = {
      width: this.width,
      placeholder: $t('Select...'),
      ...this.params.select,
      filterable: false,
      disabled: this.disabled,
      popperClass: 'select-option',
      popperAppendToBody: false,
      hideOnClickOutside: false
    }

    const treeProps = {
      ...this.params.tree,
      nodeKey: this.propsValue,
      draggable: false,
      currentNodeKey: this.ids.length > 0 ? this.ids[0] : '',
      showCheckbox: this.params.select.multiple,
      filterNodeMethod: this.filterNodeMethod
    }

    // prevent expand child when parent selectable
    if (treeProps.clickParent) {
      treeProps.expandOnClickNode = false
    }
    treeProps.defaultExpandedKeys = ensureArray(this.ids)

    const popperClass = ['el-tree-select-popper', 'el-select-dropdown', this.disabled ? 'disabled' : ''].filter(Boolean).join(' ')

    return (
      <div class="el-tree-select" style={{ ...this.styles, width: normalizeCssWidth(this.width) }}>
        <el-popover
          ref="popover"
          v-model={this.visible}
          placement={this.placement}
          popperClass={popperClass}
          width={this.state.width}
          trigger="manual"
        >
          <el-select
            slot="reference"
            ref="select"
            v-model={this.labels}
            props={selectProps}
            accordion={this.accordion}
            class="el-tree-select-input"
            on-clear={this.handleSelectClear}
            on-visible-change={this.togglePopper}
            on-remove-tag={this.handleSelectRemoveTag}
          />
          {
            this.params.tree.filterable ? (
              <div class="fbox">
                <el-input
                  v-model={this.keywords}
                  size="mini"
                  class="input-with-select"
                  nativeOn={{click: this.keywordsClick}}
                />
              </div>
            ) : null
          }
          <el-scrollbar tag="div" wrapClass="el-select-dropdown__wrap" viewClass="el-select-dropdown__list" class="is-empty">
            <el-tree
              ref="tree"
              key={treeProps.nodeKey}
              v-show={this.data.length > 0}
              props={omit(treeProps, 'data')}
              data={this.data}
              accordion={this.accordion}
              on-check={this.handleTreeCheck}
              on-node-click={this.handleTreeNodeClick}
              on-current-change={this.handleTreeCurrentChange}
              { ...{
                scopedSlots: {
                  default: (item: any) => (<span class="el-tree-node__label" title={item.node.label}>{item.node.label}</span>)
                }
              }}
            />
            { this.data.length === 0 ? (<div class="el-select-dropdown__empty">{$t('No Data')}</div>) : null }
          </el-scrollbar>
        </el-popover>
      </div>
    )
  }

  @Watch('keywords')
  handleFilter (q: string) {
    this.$tree.filter(q)
    this.$emit('search', q)
  }

  keywordsClick ($event: any) {
    $event.stopPropagation()
    this.showPopper()
  }

  /**
   * Update select label view and sync tree checked items
   */
  setTreeCheckedKeys (keys: K[]) {
    const el = this.$tree
    if (!el) {
      throw new Error('tree instance not exists')
    }

    const { multiple } = this.params.select

    if (keys.length === 0 || this.data.length === 0) {
      this.labels = multiple ? [] : ''
      if (multiple) {
        el.setCheckedKeys([])
      } else {
        el.setCurrentKey(null)
      }
    } else {
      if (multiple) {
        el.setCheckedKeys(keys)
        this.labels = this.parseTextModel(el.getCheckedNodes())
      } else {
        const key = keys[0]
        if (el.getCurrentKey() !== key) {
          el.setCurrentKey(key)
        }
        const node = this.getCurrentNode()
        this.labels = this.parseTextModel(node ? node.data : null)
      }
    }
  }

  getCurrentNode (): TreeNode<K, D> | null {
    const tree = this.$tree
    return tree && tree.store.getCurrentNode() || null
  }

  // @see element-ui/types/tree#ElTree.filterNodeMethod
  filterNodeMethod (value: string, data: D, node: TreeNode<K, D>): boolean {
    if (!value) return true
    return data[this.propsLabel].indexOf(value) !== -1
  }

  handleTreeNodeClick (data: D, node: TreeNode<K, D>, vm: ElTree<K, D>) {
    const { multiple } = this.params.select
    const { clickParent } = this.params.tree
    const { propsValue, propsChildren, propsDisabled } = this

    if (data[propsDisabled]) {
      return
    }

    let ids: K[] = []
    if (node.checked) {
      const value = data[this.propsValue]
      ids = this.ids.filter(id => id !== value)
    } else if (!multiple) {
      if (!clickParent) {
        const children = data[propsChildren]
        if (!children || children.length === 0) {
          ids = [data[propsValue]]
          this.hidePopper()
        } else {
          return
        }
      } else {
        ids = [data[propsValue]]
        this.hidePopper()
      }
    } else {
      ids.push(data[propsValue])
    }

    this.emitModel(ids)
    this.$emit('node-click', data, node, vm)
  }

  handleTreeCheck (data: D, args: TreeCheckEventArgs<K, D>) {
    const { propsValue } = this
    const ids = args.checkedNodes.reduce((ids, n) => (ids.push(n[propsValue]), ids), [] as K[])
    this.$emit('check', data, args)
    this.emitModel(ids)
  }

  handleTreeCurrentChange (data: D | null, node: TreeNode<K, D>) {
  }

  // handle tag removed
  handleSelectRemoveTag (tag: string) {
    const { data, propsValue, propsLabel, propsChildren } = this

    // remaining indexes
    let ids = this.ids

    const iterate = (d: D) => {
      let children = []
      if (d[propsChildren] && d[propsChildren].length > 0) {
        children = d[propsChildren]
      }
      if (d[propsLabel] === tag) {
        const value = d[propsValue]
        ids = ids.filter(id => id !== value)
      }
      if (children.length) {
        children.forEach(iterate)
      }
    }

    data.forEach(iterate)

    this.$tree.setCheckedKeys(ids)
    this.$emit('removeTag', tag, ids)

    this.emitModel(ids)
  }

  handleSelectClear () {
    this.emitModel([])
    this.$emit('clear')
  }

  updatePopper () {
    this.$popover.updatePopper()
  }

  hidePopper (trigger: boolean = true) {
    this.visible = false
    this.keywords = ''
    if (trigger) {
      this.$select.toggleMenu()
    }
    this.$emit('collapse')
  }

  showPopper () {
    this.syncPopperUI()
    this.visible = true
    this.$emit('expand')
  }

  togglePopper (visible: boolean) {
    if (visible) {
      this.showPopper()
    } else {
      this.hidePopper(false)
    }
  }

  // submit current checked values(s), trigger v-model and sync events
  emitModel (indexes: K[]) {
    if (!valueEquals(this.ids, indexes)) {
      this.ids = indexes
      this.setTreeCheckedKeys(indexes)
      this.nextTick(() => {
        const node = this.getCurrentNode()
        if (node) {
          this.$emit('update:entity', node.data)
        }
      })
    }

    const { multiple } = this.params.select
    const v = multiple ? indexes : indexes.length > 0 ? indexes[0] : undefined
    if (!valueEquals(this.value, v)) {
      this.$emit('input', v)
      this.$emit('change', v)
      this.$emit('select-node', this.getCurrentNode())
      this.dispatch('ElFormItem', 'el.form.change', v)
    }
  }

  nextTick (fn: () => void) {
    this.$nextTick(() => {
      if (this._isDestroyed) return
      fn()
    })
  }

  syncPopperUI () {
    this.state.width = this.$select.$el.getBoundingClientRect().width
  }

  /** API: update tree data */
  setTreeData (data: D[]): void {
    this.data = data
    this.nextTick(() => this.setTreeCheckedKeys(this.ids))
  }

  /** API: filter tree */
  filterTree (val: any): void {
    this.$tree.filter(val)
  }

  private initClickOutside () {
    const handleClick = (e: Event) => {
      const sender = e.target as Element
      const isInter = [this.$el, ...Object.values((this.$refs as any) as Vue[]).map(o => o.$el)].some(c => contains(c, sender))
      if (!isInter && this.visible) {
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

  private parseTextModel (entity: D | D[] | null) {
    const multiple = this.params.select.multiple
    const { propsLabel } = this
    const getLabel = (o: D): string => o && get(o, propsLabel) || ''
    return !multiple
      ? entity && getLabel(entity as D) || ''
      : ((entity || []) as D[]).map(getLabel)
  }
}
