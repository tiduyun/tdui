import { CreateElement } from 'vue'
import { Component, Prop, Vue } from 'vue-property-decorator'

import { assign, deepAssign, identity, isEmpty, omit, pick, unset } from '@tdio/utils'

import { debounce } from '@/utils/decorators'
import { reactSet } from '@/utils/vue'

import './style.scss'

type IGenericAction<A, T> = (arg1?: A) => Promise<T>

// abstract query interface
interface IQuery extends Kv {}

// pagination
interface IPagination {
  page?: number;
  size?: number;
  total?: number;
}

// data list api params
interface IListParams <Q extends IQuery = IQuery> extends Kv {
  query: Q;
  pager?: IPagination;
}

// This interface for store list type data that with pagination info
interface IListResult<T, Q> {
  query: Q;
  pager?: IPagination;
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

  created () {
    const state = this.storeState
    const initialState = this.initialState

    // reset store state
    reactSet(state, {
      query: {},
      pager: newPager(),
      list: [],
      loading: false
    })

    // Optioanl set initialize state
    if (initialState) {
      reactSet(state, initialState)
    }

    if (this.loadOnCreated) {
      this.load()
    }

    // setup auto reload daemon
    this._setupLoadDaemon()
  }

  load (params: Partial<IListParams> = {}): Promise<Ds<Q, T>> {
    const state = this.storeState

    if (!state.query) state.query = {}
    if (!state.pager) state.pager = newPager()

    if (!isEmpty(params)) {
      deepAssign(state, params)
    }

    // get state refs omitting `list` property
    const listParams = omit(state, 'list') as IListParams<Q>
    if (!this.showPagination) {
      unset(listParams, 'pager')
    }

    // merge custom query
    const holder: Q = { ...listParams.query }
    listParams.query = this.chainQuery(holder) || holder

    // update local state
    reactSet(state, listParams)

    return this._load(listParams)
  }

  onSizeChange (size: number) {
    this.load({ pager: { size } })
  }

  onPageChange (page: number) {
    this.load({ pager: { page } })
  }

  onSortChange ({ column, prop, order }: any) {
    this.load({ query: { sortProp: prop, sortOrder: order } })
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
            <div v-loading={ state.loading && !state.silent } class="v-gridlist__grid">{ gridSlot({ ...scope, grid: state }) }</div>
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
    const state = this.storeState
    state.loading = true
    return this.storeLoadList(this.paramsReduce(params)).then(
      (ret) => {
        assign(state, { ...ret, loading: false })
        return ret
      },
      (err) => {
        state.loading = false
        throw err
      }
    )
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
            this.load({ silent: true }).finally(() => {
              unset(state, 'silent')
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
