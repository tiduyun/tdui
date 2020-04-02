import { CreateElement, VNode } from 'vue'
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'

import './ViewLoader.scss'

interface ViewLoaderResponseArgs {
  isLoading: boolean;
}

@Component({
  componentName: 'ViewLoader'
})
export class ViewLoader extends Vue {
  @Prop(Boolean)
  loading!: boolean

  isLoading = true

  @Watch('loading')
  setLoading (state: boolean) {
    this.isLoading = state
  }

  created () {
    const timer = setTimeout(() => {
      this.setLoading(true)
    }, 10)

    this.$on('response', ({ isLoading }: ViewLoaderResponseArgs) => {
      clearTimeout(timer)
      this.setLoading(!!isLoading)
    })
  }

  render (h: CreateElement) {
    const {
      isLoading,
      $slots: {
        default: View
      }
    } = this

    const classes: Kv<boolean> = {
      'v-viewloader': true,
      loading: isLoading
    }

    // Restore classes patched by directives, eg. el-loading-parent--relative
    const $el = this.$el
    const prevClass = $el && $el.className
    if (prevClass) {
      prevClass.split(' ').forEach(k => {
        if (classes[k] == null) {
          classes[k] = true
        }
      })
    }

    return (
      <div class={classes} v-loading={isLoading}>
        { View }
      </div>
    )
  }
}
