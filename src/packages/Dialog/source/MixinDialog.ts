import { ElDialog } from 'element-ui/types/dialog'
import { Component, Mixins, Prop, Vue, Watch } from 'vue-property-decorator'

import { hasOwn, isEmpty, isFunction, isPromise, isValue } from '@tdio/utils'

import { parseBase64 } from '@/utils'
import { findDownward } from '@/utils/vue'

import { IDialogModel } from './types'

const parseRouterArgs = (blob: string): [string, any] | null => {
  if (blob) {
    let [key, data] = blob.split('|')
    if (data) {
      try {
        data = parseBase64(decodeURIComponent(data))
      } catch (e) {}
    }
    return [key, data]
  }
  return null
}

@Component
class MixinDialog extends Vue {
  @Prop({ type: Boolean, default: false })
  visible!: boolean

  @Prop({ type: String })
  title!: boolean

  @Prop({ type: Object, default: () => ({ visible: false, data: {} }) })
  entity!: IDialogModel

  @Prop(String)
  className!: string

  @Prop(String)
  routeQueryKey!: string

  state: IDialogModel = { visible: false, data: {} }

  get dlgRef (): ElDialog {
    return findDownward(this, 'ElDialog') as ElDialog
  }

  close () {
    this.state.visible = false
  }

  show () {
    this.state.visible = true
  }

  @Watch('visible')
  setVisible (v: boolean) {
    const state = this.state
    if (v !== state.visible) {
      state.visible = v
    }
  }

  syncVisible () {
    const { state } = this
    this.$emit('update:entity', state)
    this.$emit('update:visible', state.visible)
  }

  initRouter () {
    const routeQueryKey = this.routeQueryKey
    if (!routeQueryKey) {
      return
    }

    const QUERY_KEY = 'dlg' // query key name for sync router

    const getDialogRouterArgs = () => {
      const query = { ...this.$route.query }
      return parseRouterArgs(query[QUERY_KEY])
    }

    const unwatch = this.$watch('$route', (to: { path: string; }) => {
      let closeDlg = true
      const args = getDialogRouterArgs()
      if (args) {
        const [key, data] = args
        if (key === routeQueryKey) {
          closeDlg = false
          this.state.data = { ...this.state.data, ...data }
          this.$nextTick(() => this.show())
        }
      }
      if (closeDlg) {
        this.close()
      }
    }, { immediate: true })

    this.$once('hook:beforeDestroy', () => {
      unwatch()
    })

    // push/pop router states
    this.$on('show', () => {
      const [key, data] = getDialogRouterArgs() || []
      if (key !== routeQueryKey) {
        const query = { ...this.$route.query }
        query[QUERY_KEY] = routeQueryKey
        this.$router.push({ query })
      }
    })

    this.$on('close', () => {
      const query = { ...this.$route.query }
      if (hasOwn(query, QUERY_KEY)) {
        delete query[QUERY_KEY]
        this.$router.replace({ query })
      }
    })
  }

  created () {
    // sync state with instance props
    const { entity, title, visible } = this

    if (entity) {
      this.state = entity
    }

    const { state } = this
    const syncVisible = this.syncVisible.bind(this)

    if (isValue(title) && state.title !== title) {
      state.title = title
    }
    if (isValue(visible) && state.visible !== visible) {
      state.visible = visible
      syncVisible()
    }

    if (isFunction(this.state.$init)) {
      this.state.$init(this)
    }

    const onSubmit = state.onSubmit
    if (onSubmit && isFunction(onSubmit)) {
      this.$on('submit', (e: Event, resolve: ICallback) => {
        const r: any = onSubmit.call(state, e)
        if (isPromise(r)) {
          r.then((a: any) => resolve(null, a), resolve)
        } else {
          this.$nextTick(resolve)
        }
      })
    }

    this.$on('close', syncVisible)
    this.$on('opened', syncVisible)

    // sync dialog state to router
    this.initRouter()
  }
}

export default Mixins(MixinDialog)
