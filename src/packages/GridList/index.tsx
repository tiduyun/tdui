import { decode as d64, encode as b64 } from '@allex/base64'
import qs from 'querystring'
import { CreateElement } from 'vue'
import { Component, Prop, Vue } from 'vue-property-decorator'

import {
  assign, deepClone, defaultTo, deferred, DeferredPromise, get, guid, hasOwn, identity, isEmpty,
  isEqual, isObject, merge, omit, pick, set, unset
} from '@tdio/utils'
import { findDownward } from '@tdio/vue-utils'
import { debounce as Debounce } from '@tdio/vue-utils'

import { Nullable } from '../../types/common'
import { createState, IStateService } from '../../utils/state-factory'

import './style.scss'

type IGenericAction<A, T> = (arg1?: A) => Promise<T>

// abstract query interface
interface IQuery extends Kv {}

// pagination
interface IPagination {
  page: number;
  size: number;
  total?: number;
}

// Data list api params
interface IListParams <Q extends IQuery = IQuery> {
  query: Q;
  pager?: Nullable<IPagination>;

  // Internal config for io
  $xargs?: Nullable<{
    silent?: boolean;
    loading?: boolean;
    seqId?: string;
  }>;

  lastLoadTime?: number;
}

// This interface for store list type data that with pagination info
interface IListResult<Q extends IQuery, T> extends IListParams<Q> {
  list: T[];
}

interface ReloadOptions {
  enable: boolean;
  interval: number;
}

interface PrimaryState<Q = IQuery> {
  query: Q;
  pager?: Nullable<IPagination>;
}

interface SetStateOpts {
  force?: boolean;
}

const { setTimeout, clearTimeout } = window

const parseQuery = (query: string): Kv => {
  const res: Kv = {}

  query = query.trim().replace(/^(\?|#|&)/, '')
  if (!query) {
    return res
  }

  return qs.decode(query)
}

const diff = (object: any, base: any): Kv => {
  return Object.keys(object).reduce((r, k) => {
    const v = object[k]
    if (!isEqual(v, base[k])) {
      r[k] = isObject(v) && isObject(base[k]) ? diff(v, base[k]) : v
    }
    return r
  },
  {} as Kv)
}

/**
 * Return a new reduced object for mutates (optional deep cloned)
 */
function updateState <T> (oldState: T, newState: Partial<T>): Partial<T> {
  return Object.keys(newState).reduce((p: any, k) => {
    const v = get<{}>(newState, k)
    // deep copy condition parameters
    p[k] = (isObject(v) && ['query', 'pager', '$xargs'].includes(k))
      ? merge({}, p[k], v)
      : v
    return p
  }, { ...oldState })
}

function assertInitialState (listParams: IListParams) {
  const keys = Object.keys(listParams)
  if (keys.indexOf('list') !== -1) {
    console.error('Invalid `initialState` ref, `.list` is reserved. see IListParams for more details')
    unset(listParams, 'list')
  }
}

@Component
export class GridList <Q extends IQuery = IQuery,  T = any> extends Vue {
  @Prop({ type: Function, required: true })
  storeLoadList!: IGenericAction<IListParams<Q>, IListResult<Q, T>>

  @Prop({ type: [Object, Array], default: () => ({}) })
  storeState!: any

  @Prop({ type: Object })
  initialState!: IListParams<Q>

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

  /**
   * Set true to enable sync url state plugin
   */
  @Prop(Boolean)
  syncUrlState!: boolean

  /**
   * Query state identify key name. (used for sync state plugin)
   */
  @Prop({ type: String, default: '_sts' })
  queryStateKey!: string

  private debounceRef!: [
    number,
    IListParams<Q>,
    DeferredPromise<IListResult<Q, T>>
  ] | null

  // state store
  private st!: IStateService<IListResult<Q, T>>

  // cache the initialize PST
  private initPST!: PrimaryState<Q>

  // cache the last PST
  private lastPST!: PrimaryState<Q>

  /* Api for element-ui/pagination implements */
  get internalPageCount (): number {
    const pager = this.st.get('pager') || {}
    return Math.ceil(get(pager, 'total', 0)! / get(pager, 'size', 10)!)
  }

  /**
   * Cherry pick primary state.
   *
   * @return Returns a copy of the state
   */
  getPST (): PrimaryState<Q> {
    const { query, pager } = deepClone(this.st.pick(['query', 'pager']))
    if (pager) {
      unset(pager, 'total')
    }
    return { query, pager }
  }

  created () {
    // init state store
    this.st = createState<IListResult<Q, T>>(this.storeState, {
      reducer: updateState
    })

    this.$on('hook:beforeDestroy', () => {
      this.st.destroy()
    })

    const initialState = this.initialState
    if (initialState) {
      // verify `initialState`
      assertInitialState(initialState)
    }

    // assign initialize state with defaults
    const initial: IListResult<Q, T> = merge(
      {
        query: {},
        pager: null,
        list: [],
        $xargs: {
          loading: false
        }
      },
      initialState
    )
    if (this.showPagination) {
      initial.pager = { page: 1, size: 10, ...initial.pager }
    }
    this.st.hmset(initial)

    // cache the initial state
    this.initPST = this.getPST()

    // init sync state plugin
    if (this.syncUrlState) {
      this._initStateSync()
    }

    if (this.loadOnCreated) {
      this._load()
    }

    // setup auto reload daemon
    this._setupLoadDaemon()
  }

  load (params: Partial<IListParams<Q>> = {}, opts: { debounce?: number; } = {}): Promise<IListResult<Q, T>> {
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
    this.st.set('pager.size', size)
    this.debounceLoad()
  }

  onPageChange (page: number) {
    this.st.set('pager.page', page)
    this.debounceLoad()
  }

  onSortChange ({ column, prop, order }: any) {
    const sortOrder = order || undefined
    const sortProp = sortOrder ? prop : undefined
    this.st.set('query', { sortProp, sortOrder })
    this.debounceLoad()
  }

  setState <T> (k: string, v: T) {
    this.st.set(k, v)
  }

  render () {
    const state = this.st.get<IListResult<Q, T>>()!
    const {
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
                      on={{ 'update:currentPage': (e: number) => state.pager!.page = e }}
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

  @Debounce(100)
  private debounceLoad (): void {
    this._load()
  }

  /**
   * Internal load with debounce supports
   * @private
   */
  private _load (params: Partial<IListParams<Q>> = {}, opts: { debounce?: number; } = {}): Promise<IListResult<Q, T>> {
    const debounce = opts.debounce || 0
    const pst = this.getPST()

    const merged: IListParams<Q> = merge({}, pst, params)
    if (!this.showPagination) {
      merged.pager = undefined
    }

    // debounce controller
    if (debounce > 0) {
      const ref = this.debounceRef
      if (ref) {
        if (ref[0]) {
          clearTimeout(ref[0])
          ref[1] = merged
        } else {
          const isModified = !isEqual(this.lastPST, pst)
          return !isModified
            ? ref[2]
            : ref[2].finally(() => this._load(params, opts))
        }
      }

      const defer = deferred<IListResult<Q, T>>()
      defer.finally(() => this.debounceRef = null)

      const timer = setTimeout(() => {
        const ref = this.debounceRef!
        ref[0] = 0
        this._fetchApi(ref[1]).then(defer.resolve, defer.reject)
      }, debounce)

      this.debounceRef = [timer, merged, defer]
      return defer
    }

    return this._fetchApi(merged)
  }

  private _fetchApi (params: IListParams<Q>): Promise<IListResult<Q, T>> {
    const state = this.st

    params = params && deepClone(params) || {}

    // set `pager` property for standard api spec
    if (!this.showPagination) {
      unset(params, 'pager')
    } else {
      params.pager = {
        ...state.get<IPagination>('pager'),
        ...params.pager!
      }
    }

    // apply chain query
    const hoist: Q = { ...params.query }
    params.query = defaultTo(this.chainQuery(hoist), hoist, v => v !== undefined)

    // override with explicit parameters, and apply to reducer
    params = this.paramsReduce(params)

    // sequences id, used for api sequence valid
    let isRequestValid = true
    const seqId = guid()

    // write query state
    state
      .hmset(params, true)
      .set('$xargs', { loading: true, seqId })

    this.lastPST = this.getPST()
    this.$emit('beforeLoad', params)

    return this.storeLoadList(params)
      .then(res => {
        // verify checksum
        isRequestValid = state.get('$xargs.seqId') === seqId
        if (!isRequestValid) {
          throw new Error('Invalid parallel request (aborted)')
        }

        const p0: IPagination | undefined = get(params, 'pager')
        const p1: IPagination | undefined = get(res, 'pager')

        // fixup pagination if response w/o pager info
        if (p0 && !p1 && get(res, 'list')) set(res, 'pager', p0)

        // patches page number mismatch with backend response
        let total = 0
        if (p0 && p1 && (total = p1.total!)) {
          const { page, size } = p1
          const rpage = Math.ceil(total / size)
          if (p0.page > rpage) {
            // retry for last page
            return this._fetchApi({
              ...params,
              pager: { ...p0, page: rpage }
            })
          }
        }

        if (res.pager) {
          params.pager = res.pager
        }

        return state
          .hmset({ ...omit(res, ['query']), ...params })
          .get<IListResult<Q, T>>()!
      })
      .finally(() => {
        if (isRequestValid) {
          state.hmset({ $xargs: null, lastLoadTime: Date.now() })
        }
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

    const { enable, interval } = reloadOptions

    if (enable) {
      // throttle implemention, prevent load trigger frequently
      let timer = 0
      const run = () => {
        if (timer === -1) { // destroyed
          return
        }
        if (timer) {
          clearTimeout(timer)
        }

        timer = setTimeout(() => {
          const state = this.st
          const isLoading = state.get('$xargs.loading')
          const lastLoadTime = state.get<number>('lastLoadTime')
          if (isLoading || (lastLoadTime && Date.now() - lastLoadTime < interval)) {
            // waiting next
            run()
          } else {
            // silent mode to prevent spiner
            this._load({ $xargs: { silent: true } }).finally(() => {
              state.del('$xargs.silent')
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

  /**
   * Install state query sync plugin
   */
  private _initStateSync () {
    const loc = location

    const deserializeState = (qs: string): PrimaryState<Q> | null => {
      const s: string | undefined = get(parseQuery(qs), this.queryStateKey)
      if (s) {
        try {
          return JSON.parse(d64(s))
        } catch (e) {
          console.error('Parse query state error', e)
        }
      }
      return null
    }

    // build patches and serialize
    const serializeState = (pst: PrimaryState): string =>
      b64(JSON.stringify(diff(pst, this.initPST)))

    const qsKey = this.queryStateKey
    const sts = deserializeState(loc.search)
    if (sts) {
      this.st.hmset(sts)
    }

    // catch last PST key
    let lastQs: string | undefined

    this.$on('beforeLoad', (params: IListParams<Q>) => {
      if (this._isDestroyed || get(params, '$xargs.silent')) {
        return
      }

      const newQs = serializeState(this.lastPST)

      // prevent construct-load phase when `loadOnCreated` is `true`
      if (lastQs === undefined && this.loadOnCreated) {
        lastQs = newQs
      }

      if (lastQs !== newQs) {
        lastQs = newQs
        const currQs = parseQuery(loc.search)
        this.$router[currQs[qsKey] != null ? 'replace' : 'push']({ query: { ...currQs, [qsKey]: newQs } })
      }
    })

    const unwatch = this.$watch('$route', (to: { path: string; query: Kv; }) => {
      if (lastQs === to.query[qsKey]) {
        return
      }

      // restore initial if no query state
      const sts = deserializeState(loc.search) || this.initPST!

      lastQs = serializeState(sts)
      this._fetchApi(sts)
    })

    this.$once('hook:beforeDestroy', () => { unwatch() })
  }

}
