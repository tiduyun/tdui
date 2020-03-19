import { CreateElement } from 'vue'
import { Component, Prop, Vue } from 'vue-property-decorator'

import { assign, deepAssign, deferred, DeferredPromise, get, identity, isEmpty, pick, unset } from '@tdio/utils'

import { debounce } from '@/utils/decorators'
import { reactSet } from '@/utils/vue'

import './style.scss'

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
  pager?: IPagination | Nil;

  // Internal config for io
  $xargs?: {
    silent?: boolean;
    loading?: boolean;
  }
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
  storeLoadList!: IGenericAction<IListParams, Ds<Q, T>>

  @Prop({ type: [Object, Array], default: () => ({}) })
  storeState!: any

  @Prop({ type: Object })
  initialState!: IListResult<Q, T>

  @Prop({ type: Boolean, default: true })
  showPagination!: boolean

  @Prop({ type: Boolean, default: true })
  loadOnCreated!: boolean

  @Prop({ type: Function, default: identity })
  chainQuery!: (query: Q) => Q

  @Prop({ type: Function, default: identity })
  paramsReduce!: (params: IListParams) => IListParams

  @Prop({ type: [Boolean, Object], default: false })
  autoReload!: boolean | ReloadOptions

  debounceRef!: [number, DeferredPromise<Ds<Q, T>>] | null

  /* Api for element-ui/pagination implements */
  get internalPageCount (): number {
    const { pager = {} } = this.storeState
    return Math.ceil(get(pager, 'total', 0)! / get(pager, 'size', 10)!)
  }

  setState (state: Partial<IListParams | { pager: Partial<IPagination> | Nil; }>, force?: boolean) {
    const store = this.storeState
    reactSet(
      store,
      force
        ? state
        : deepAssign({}, store, state, (r, s, k) => k === 'list' ? s : undefined)
    )
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
      this.load()
    }

    // setup auto reload daemon
    this._setupLoadDaemon()
  }

  load (params: Partial<IListParams> = {}, opts: { debounce?: number; } = {}): Promise<Ds<Q, T>> {
    const state = this.storeState

    if (!isEmpty(params)) {
      this.setState(params)
    }

    // cleanup previous if deferred
    const ref = this.debounceRef
    if (ref) {
      clearTimeout(ref[0])
      ref[1].reject('abort')
      this.debounceRef = null
    }

    const debounce = opts.debounce || 0
    if (debounce > 0) {
      const defer = deferred<Ds<Q, T>>()
      const timer = setTimeout(() => this.load().then(defer.resolve, defer.reject), debounce)
      this.debounceRef = [timer, defer]
      return defer
    }

    const apiParams = pick(state, ['query']) as IListParams<Q>
    if (!this.showPagination) {
      apiParams.pager = null
    } else {
      apiParams.pager = state.pager
    }

    // Apply custom query
    const hoist: Q = { ...state.query }
    apiParams.query = this.chainQuery(hoist) || hoist

    return this._load(apiParams)
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

  render (h: CreateElement) {
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
    return (
      <div class="v-gridlist">
        {
          formSlot ? (
            <div class="v-gridlist__toolbar">{ formSlot({ ...scope, query: state.query }) }</div>
          ) : null
        }
        {
          gridSlot ? (
            <div v-loading={ get(state, '$xargs.loading') && !get(state, '$xargs.silent') } class="v-gridlist__grid">{ gridSlot({ ...scope, grid: state }) }</div>
          ) : null
        }
        {
          (this.showPagination && state.pager && !isEmpty(state.list)) ? (
            <div class="v-gridlist__pagination">
              {
                pagerSlot ? pagerSlot({ ...scope, pager: state.pager })
                  : (
                    <el-pagination
                      total={state.pager.total}
                      layout="total, sizes, prev, pager, next, jumper"
                      pageSize={Math.max(10, ~~(state.pager.size / 5) * 5)}
                      pageSizes={[10, 15, 20, 30]}
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

  private _load (params: IListParams): Promise<Ds<Q, T>> {
    // update local state
    this.setState({
      ...params,
      $xargs: {
        loading: true
      }
    })

    const listParams = this.paramsReduce({
      ...params,
      $xargs: this.storeState.$xargs
    })

    const p0 = listParams.pager!
    return this.storeLoadList(listParams).then(
      (ret) => {
        // patches page number mismatch with backend response
        const p1 = get<IPagination>(ret, 'pager')
        let total = 0
        if (p0 && p1 && (total = p1.total)) {
          const { page, size } = p1
          const rpage = Math.ceil(total / size)
          if (p0.page > rpage) {
            return this._load({ ...params, pager: { ...p0, page: rpage } })
          }
        }
        this.setState({ ...ret, $xargs: { loading: false } })
        return ret
      },
      (err) => {
        this.setState({ $xargs: { loading: false } })
        throw err
      }
    )
  }

  @debounce(100)
  private debounceLoad (params?: Partial<IListParams>): void {
    this.load(params)
  }

  private _setupLoadDaemon () {
    const reloadOptions: ReloadOptions = ((opts: boolean | ReloadOptions) => {
      const ret: ReloadOptions = {
        enable: false,
        interval: 30000
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
      const run = () => {
        timer = setTimeout(() => {
          const state = this.storeState
          if (state.loading) {
            // add to next process if loading
            run()
          } else {
            // silent mode to prevent spiner
            this.load({ $xargs: { silent: true } }).finally(() => {
              unset(state, '$xargs.silent')
              run()
            })
          }
        }, reloadOptions.interval)
      }
      run()
      this.$on('hook:beforeDestroy', () => {
        clearTimeout(timer)
      })
    }
  }
}
