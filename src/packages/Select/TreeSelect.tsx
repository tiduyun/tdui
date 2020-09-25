import { ElPopover } from 'element-ui/types/popover'
import { ElSelect } from 'element-ui/types/select'
import { ElTree, TreeData, TreeNode } from 'element-ui/types/tree'
import { Component, Emit, Prop, Ref, Vue, Watch } from 'vue-property-decorator'

import { $t } from '@tdio/locale'
import { deepAssign, get, isArray, isValue, valueEquals } from '@tdio/utils'

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

interface TreeCheckArgs<K, D> {
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

  get popperClass () {
    return ['el-tree-select-popper', 'el-select-dropdown', this.disabled ? 'disabled' : ''].filter(Boolean).join(' ')
  }
  @Prop({ type: [Number, String, Array], default: '' })
  value!: any

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
  labels: string | string[] = '' // cache all of the option label text
  ids: K[] = [] // selected option id list (indexes)
  selectNodes: any[] = [] // selected entity list
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
    if (!valueEquals(this.ids, val)) {
      this.ids = ensureArray(val)
    }
    if (!valueEquals(val, oldVal)) {
      this.dispatch('ElFormItem', 'el.form.change', val)
    }
  }

  @Watch('ids')
  watchIds (v: K[]) {
    if (v !== undefined) {
      this.setTreeCheckedKeys(v)
    }
  }

  @Watch('selectParams', { immediate: true })
  initSelectParams (v: SelectParams) {
    deepAssign(this.params.select, getVuePropDefault(this, 'selectParams'), v)
  }

  @Watch('treeParams', { immediate: true })
  initTreeParams (v: TreeParams<D>) {
    const treeParams = this.params.tree
    deepAssign(treeParams, getVuePropDefault(this, 'treeParams'), { props: v.props || {} })

    const { multiple } = this.params.select
    const { props } = treeParams
    const data = v.data || []

    this.propsValue = props.value
    this.propsLabel = props.label
    this.propsDisabled = props.disabled
    this.propsChildren = props.children

    this.data = data.length > 0 ? [...data] : []

    this.nextTick(() => {
      this.labels = multiple ? [] : ''
      // optional select the first item
      this.ids = (this.defaultFirstOption && data.length)
        ? [data[0]![props.value]]
        : ensureArray(this.value)
    })
  }

  mounted () {
    this.syncPopperUI()
    this.nextTick(() => { on(document, 'mouseup', this.popoverHideFun) })
  }

  beforeDestroy () {
    off(document, 'mouseup', this.popoverHideFun)
  }

  render (h: any) {
    const selectProps = {
      width: this.width,
      placeholder: $t('Select...'),
      ...this.params.select,
      filterable: false,
      disabled: this.disabled,
      popperClass: 'select-option',
      popperAppendToBody: false
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

    return (
      <div class="el-tree-select" style={{ ...this.styles, width: normalizeCssWidth(this.width) }}>
        <el-popover
          ref="popover"
          v-model={this.visible}
          placement={this.placement}
          popperClass={this.popperClass}
          width={this.state.width}
          trigger="click"
        >
          <el-select
            slot="reference"
            ref="select"
            v-model={this.labels}
            props={selectProps}
            accordion={this.accordion}
            class="el-tree-select-input"
            on-clear={this.handleSelectClear}
            on-focus={this.handleSelectFocus}
            on-remove-tag={this.handleSelectRemoveTag}
          />
          {
            this.params.tree.filterable ? (
              <div class="fbox">
                <el-input v-model={this.keywords} size="mini" class="input-with-select" onChange={this.handleFilter}>
                  <el-button slot="append" icon="el-icon-search" />
                </el-input>
              </div>
            ) : null
          }
          <el-scrollbar tag="div" wrapClass="el-select-dropdown__wrap" viewClass="el-select-dropdown__list" class="is-empty">
            <el-tree
              ref="tree"
              key={treeProps.nodeKey}
              v-show={this.data.length > 0}
              props={(delete treeProps.data, treeProps)}
              data={this.data}
              accordion={this.accordion}
              on-check={this.handleTreeCheck}
              on-node-click={this.handleTreeNodeClick}
              on-current-change={this.handleTreeCurrentChange}
            />
            { this.data.length === 0 ? (<div class="el-select-dropdown__empty">{$t('No Data')}</div>) : null }
          </el-scrollbar>
        </el-popover>
      </div>
    )
  }

  handleFilter () {
    this.$emit('search', this.keywords)
  }

  // Set tree checked items by ids
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
      return
    }

    if (multiple) {
      el.setCheckedKeys(keys)
      this.labels = el.getCheckedNodes().map(d => d[this.propsLabel]) || []
      this.updatePopper()
    } else {
      el.setCurrentKey(keys[0])
      const node = el.store.getCurrentNode()
      const current = node ? node.data : null
      this.labels = current ? current[this.propsLabel] : ''
      this.emitModel(node)
    }
  }

  updatePopper () {
    this.$popover.updatePopper()
  }

  // @see element-ui/types/tree#ElTree.filterNodeMethod
  filterNodeMethod (value: string, data: D, node: TreeNode<K, D>): boolean {
    if (!value) return true
    return data[this.propsLabel].indexOf(value) !== -1
  }

  handleTreeNodeClick (
    data: D,
    node: TreeNode<K, D>, vm: ElTree<K, D>
  ) {
    const { multiple } = this.params.select
    const { clickParent } = this.params.tree
    const { propsValue, propsChildren, propsDisabled } = this

    if (data[propsDisabled]) {
      return
    }

    if (node.checked) {
      const value = data[this.propsValue]
      this.ids = this.ids.filter(id => id !== value)
    } else if (!multiple) {
      if (!clickParent) {
        const children = data[propsChildren]
        if (!children || children.length === 0) {
          this.ids = [data[propsValue]]
          this.visible = false
        } else {
          return
        }
      } else {
        this.ids = [data[propsValue]]
        this.visible = false
      }
    } else {
      this.ids.push(data[propsValue])
    }

    this.emitModel(node)
    this.$emit('node-click', data, node, vm)
  }

  handleTreeCheck (
    data: D,
    args: TreeCheckArgs<K, D>
  ) {
    this.ids = []

    const { propsValue } = this
    args.checkedNodes.forEach(n => this.ids.push(n[propsValue]))

    this.$emit('check', data, args)
    this.emitModel(args)
  }

  handleTreeCurrentChange (data: D | null, node: TreeNode<K, D>) {
    this.$emit('update:entity', data)
  }

  // handle tag removed
  handleSelectRemoveTag (tag: string) {
    const { data, propsValue, propsLabel, propsChildren } = this

    const iterate = (d: D) => {
      let children = []
      if (d[propsChildren] && d[propsChildren].length > 0) {
        children = d[propsChildren]
      }
      if (d[propsLabel] === tag) {
        const value = d[propsValue]
        this.ids = this.ids.filter(id => id !== value)
      }
      if (children.length) {
        children.forEach(iterate)
      }
    }

    data.forEach(iterate)

    this.$tree.setCheckedKeys(this.ids)
    this.$emit('removeTag', this.ids, tag)

    this.emitModel({})
  }

  handleSelectClear () {
    this.ids = []
    this.emitModel(null)
    this.$emit('clear')
  }

  handleSelectFocus (e: Event) {
    this.syncPopperUI()
  }

  // submit current checked values(s), trigger v-model and sync events
  emitModel (args: TreeCheckArgs<K, D> | TreeNode<K, D> | {} | null) {
    const { multiple } = this.params.select
    const v = multiple ? this.ids : this.ids.length > 0 ? this.ids[0] : undefined
    this.$emit('input', v)
    if (!valueEquals(this.value, v)) {
      this.$emit('change', v)
    }
    this.$emit('select-node', args)
    this.updatePopper()
  }

  nextTick (fn: () => void) {
    this.$nextTick(() => {
      if (this._isDestroyed) return
      fn()
    })
  }

  syncPopperUI () {
    this.nextTick(() => {
      this.state.width = this.$select.$el.getBoundingClientRect().width
    })
  }

  popoverHideFun (e: Event) {
    const sender = e.target as Element
    const isInter = [this.$el, ...Object.values((this.$refs as any) as Vue[]).map(o => o.$el)].some(c => contains(c, sender))
    if (!isInter) {
      this.visible = false
    }
  }

  /** API: update tree data */
  setTreeData (data: D[]): void {
    this.data = data
    setTimeout(() => this.setTreeCheckedKeys(this.ids), 300)
  }

  /** API: filter tree */
  filterTree (val: any): void {
    this.$tree.filter(val)
  }
}
