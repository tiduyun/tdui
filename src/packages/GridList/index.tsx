import { CreateElement } from 'vue'
import { Component, Prop, Vue } from 'vue-property-decorator'

import { assign, defaultTo, deferred, DeferredPromise, get, identity, isEmpty, isEqual, isObject, merge, omit, pick, set, unset } from '@tdio/utils'

import { debounce } from '@/utils/decorators'
import { findDownward, reactSet } from '@/utils/vue'

import { Nullable } from '../../types/common'

import './style.scss'

const deepAssign = merge

type IGenericAction<A, T> = (arg1?: A) => Promise<T>

// abstract query interface
interface IQuery extends Kv {}

// pagination
interface IPagination {
  page: number;
  size: number;
  total: number;
}

// Data list api params
interface IListParams <Q extends IQuery = IQuery> extends Kv {
  query: Q;
  pager?: Nullable<IPagination>;

  // Internal config for io
  $xargs?: Nullable<{
    silent?: boolean;
    loading?: boolean;
  }>;

  lastLoadTime?: number;
}

// This interface for store list type data that with pagination info
interface IListResult<T, Q> extends IListParams<Q> {
  list: T[];
}

type Ds<Q, T> = IListResult<T, Q> | T[]

interface ReloadOptions {
  enable: boolean;
  interval: number;
}

const { setTimeout, clearTimeout } = window
const newPager = (page: number = 1, size: number = 10) => ({ page, size })

@Component
export class GridList <Q extends IQuery = IQuery, T = any> extends Vue {
  @Prop({ type: Function, required: true })
  storeLoadList!: IGenericAction<IListParams<Q>, Ds<Q, T>>

  @Prop({ type: [Object, Array], default: () => ({}) })
  storeState!: any

  @Prop({ type: Object })
  initialState!: IListResult<Q, T>

  @Prop({ type: Boolean, default: true })
  showPagination!: boolean

  @Prop({ type: Array })
  pageSizes!: number[]

  @Prop({ type: Boolean, default: true })
  loadOnCreated!: boolean

  @Prop({ type: Function, default: identity })
  chainQuery!: (query: Q) => Q

  @Prop({ type: Function, default: identity })
  paramsReduce!: (params: IListParams<Q>) => IListParams<Q>

  @Prop({ type: [Boolean, Object], default: false })
  autoReload!: boolean | ReloadOptions

  @Prop({ type: Boolean, default: true })
  clearSelectionOnLoad!: boolean

  debounceRef!: [
    number,
    Partial<IListParams<Q>>,
    DeferredPromise<Ds<Q, T>>
  ] | null

  /* Api for element-ui/pagination implements */
  get internalPageCount (): number {
    const { pager = {} } = this.storeState
    return Math.ceil(get(pager, 'total', 0)! / get(pager, 'size', 10)!)
  }

  setState (state: Partial<IListParams<Kv> | { pager: Nullable<Partial<IPagination>>; }>, force?: boolean) {
    const s0 = this.storeState

    // ignore list property, and fixup empty string ('') as undefined
    const s1 = force
      ? state
      : Object.keys(state).reduce((p, k) => {
          const v = get(state, k)
          // deep merge by whitelist
          p[k] = (isObject(v) && ['query', 'pager', '$xargs'].includes(k))
            ? deepAssign({}, p[k], v)
            : v
          return p
        }, { ...s0 })

    reactSet(s0, s1)
  }

  created () {
    // set initialize state optionally
    const initialState = deepAssign({
      query: {},
      pager: newPager(),
      list: [],
      $xargs: {
        loading: false
      }
    }, this.initialState)

    this.setState(initialState)

    if (this.loadOnCreated) {
      this._load()
    }

    // setup auto reload daemon
    this._setupLoadDaemon()
  }

  load (params: Partial<IListParams<Q>> = {}, opts: { debounce ?: number; } = {}): Promise<Ds<Q, T>> {
    return this._load(params, opts).finally(() => {
      if (this.clearSelectionOnLoad) {
        // try to clear table selections when call load manually
        const table = findDownward(this, 'ElTable')
        if (table) {
          try {
            table.clearSelection()
          } catch (e) {
            console.error(e)
          }
        }
      }
    })
  }

  onSizeChange (size: number) {
    this.setState({ pager: { size } })
    this.debounceLoad()
  }

  onPageChange (page: number) {
    this.setState({ pager: { page } })
    this.debounceLoad()
  }

  onSortChange ({ column, prop, order }: any) {
    this.setState({ query: { sortProp: prop, sortOrder: order } })
    this.debounceLoad()
  }

  render () {
    const {
      storeState: state,
      $scopedSlots: {
        default: defaultSlot,
        form: formSlot,
        table: gridSlot,
        pagination: pagerSlot
      }
    } = this

    const scope = { $ctx: this }
    const pageSizes = this.pageSizes
    const $xargs = state.$xargs || {}

    return (
      <div class="v-gridlist">
        { formSlot && (<div class="v-gridlist__toolbar">{ formSlot({ ...scope, query: state.query }) }</div>) }
        { gridSlot && (<div class="v-gridlist__grid" v-loading={ $xargs.loading && !$xargs.silent }>{ gridSlot({ ...scope, grid: state }) }</div>) }
        {
          (this.showPagination && state.pager && !isEmpty(state.list)) ? (
            <div class="v-gridlist__pagination">
              {
                pagerSlot ? pagerSlot({ ...scope, pager: state.pager })
                  : (
                    <el-pagination
                      total={state.pager.total}
                      layout="total, sizes, prev, pager, next, jumper"
                      pageSize={!isEmpty(pageSizes) ? state.pager.size : Math.max(10, ~~(state.pager.size / 5) * 5)}
                      pageSizes={defaultTo(pageSizes, [10, 15, 20, 30], (o) => !isEmpty(o))}
                      currentPage={state.pager.page}
                      on={{ 'update:currentPage': (e: number) => state.pager.page = e }}
                      on-size-change={this.onSizeChange}
                      on-current-change={this.onPageChange}
                    />
                  )
              }
            </div>
          ) : null
        }
      </div>
    )
  }

  @debounce(100)
  private debounceLoad (params?: Partial<IListParams<Q>>): void {
    this._load(params)
  }

  private _load (params: Partial<IListParams<Q>> = {}, opts: { debounce ?: number; } = {}): Promise<Ds<Q, T>> {
    // Internal core load with debounce featured

    const state = this.storeState
    const debounce = opts.debounce || 0

    // debounce controller
    if (debounce > 0) {
      const ref = this.debounceRef
      if (ref) {
        if (ref[0]) {
          clearTimeout(ref[0])
          ref[1] = params
        } else {
          const isModified = ['query', 'pager'].some(k => !isEqual(state[k], deepAssign({}, state[k], params[k])))
          return !isModified
            ? ref[2]
            : ref[2].then(() => this._load(params, opts))
        }
      }

      const defer = deferred<Ds<Q, T>>()
      defer.then(() => this.debounceRef = null)

      const timer = setTimeout(() => {
        const ref = this.debounceRef!
        ref[0] = 0
        this._requestData(ref[1]).then(defer.resolve, defer.reject)
      }, debounce)

      this.debounceRef = [timer, params, defer]
      return defer
    }

    return this._requestData(params)
  }

  private _requestData (params: Partial<IListParams<Q>>): Promise<Ds<Q, T>> {
    const state = this.storeState

    let apiParams = pick(state, ['query']) as IListParams<Q>
    apiParams.pager = this.showPagination ? state.pager : null

    // apply chain query
    const hoist: Q = { ...state.query }
    apiParams.query = this.chainQuery(hoist) || hoist

    // override with explicit parameters, and apply to reducer
    apiParams = this.paramsReduce(deepAssign(apiParams, params))

    this.setState({
      $xargs: {
        ...get(params, '$xargs'),
        loading: true
      }
    })

    const p0 = apiParams.pager!
    const arg0 = pick(apiParams, ['query'])

    return this.storeLoadList(apiParams)
      .then(
        (ret) => {
          const p1 = get<IPagination>(ret, 'pager')

          // fixup pagination if response w/o pager info
          if (p0 && !p1 && get(ret, 'list')) set(ret, 'pager', p0)

          // patches page number mismatch with backend response
          let total = 0
          if (p0 && p1 && (total = p1.total)) {
            const { page, size } = p1
            const rpage = Math.ceil(total / size)
            if (p0.page > rpage) {
              return this._requestData({ ...params, pager: { ...p0, page: rpage } })
            }
          }

          this.setState({ ...omit(ret, ['query']) })
          return ret
        }
      ).finally(() => {
        this.setState({ ...arg0, $xargs: null, lastLoadTime: Date.now() })
      })
  }

  private _setupLoadDaemon () {
    const reloadOptions: ReloadOptions = ((opts: boolean | ReloadOptions) => {
      const ret: ReloadOptions = {
        enable: false,
        interval: 5000
      }
      if (typeof opts === 'boolean') {
        ret.enable = opts
      } else {
        assign(ret, opts)
      }
      return ret
    })(this.autoReload)

    if (reloadOptions.enable) {
      let timer = 0
      const interval = reloadOptions.interval

      const run = () => {
        if (timer === -1) { // destroyed
          return
        }
        if (timer) {
          clearTimeout(timer)
        }
        timer = setTimeout(() => {
          const state = this.storeState
          const lastLoadTime = state.lastLoadTime
          if (
            get(state, '$xargs.loading') ||
            (lastLoadTime && Date.now() - lastLoadTime < interval)
          ) {
            // add to next process if loading
            run()
          } else {
            // silent mode to prevent spiner
            this._load({ $xargs: { silent: true } }).finally(() => {
              unset(state, '$xargs.silent')
              run()
            })
          }
        }, interval)
      }

      run()

      this.$on('hook:beforeDestroy', () => {
        clearTimeout(timer)
        timer = -1 // destroyed
      })
    }
  }
}
