import { ElDialog } from 'element-ui/types/dialog'
import { Component, Mixins, Prop, Vue, Watch } from 'vue-property-decorator'

import { get, hasOwn, isEmpty, isFunction, isPromise, isValue } from '@tdio/utils'

import { parseBase64 } from '@/utils'
import { findDownward } from '@/utils/vue'

import { IDialogModelService } from './DialogModelService'

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
  entity!: IDialogModelService<any, Kv>

  @Prop(String)
  className!: string

  @Prop(String)
  routeQueryKey!: string

  get dlgRef (): ElDialog {
    return findDownward(this, 'ElDialog') as ElDialog
  }

  close () {
    this.entity.visible = false
  }

  show () {
    this.entity.visible = true
  }

  @Watch('visible')
  setVisible (v: boolean) {
    this.entity.visible = !!v
  }

  created () {
    // sync state with instance props
    const { entity, title, visible } = this

    const syncVisible = this.syncVisible.bind(this)

    if (isValue(title) && entity.title !== title) {
      entity.title = title
    }
    if (isValue(visible) && entity.visible !== visible) {
      entity.visible = visible
      syncVisible()
    }

    this.callInter('created')

    const onSubmit = entity.onSubmit
    if (onSubmit && isFunction(onSubmit)) {
      this.$on('submit', (e: Event, resolve: ICallback) => {
        const r: any = onSubmit.call(entity, e)
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

  private syncVisible () {
    const { entity } = this
    this.$emit('update:entity', entity)
    this.$emit('update:visible', entity.visible)
  }

  private initRouter () {
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
          this.entity.data = { ...this.entity.data, ...data }
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

  private callInter (hook: string) {
    const inter = this.entity
    const f = get<(...args: any[]) => any>(inter, hook)
    if (f && isFunction(f)) {
      f.call(inter, this)
    }
  }
}

export default Mixins(MixinDialog)
