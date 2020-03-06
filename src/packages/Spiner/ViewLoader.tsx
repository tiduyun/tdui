import { CreateElement, VNode } from 'vue'
import { Component, Prop, Vue, Watch } from 'vue-property-decorator'

interface ViewLoaderResponseArgs {
  isLoading: boolean;
}

@Component({
  componentName: 'ViewLoader'
})
export class ViewLoader extends Vue {
  @Prop(Boolean)
  loading!: boolean

  isLoading = false

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
        default: contentSlot
      }
    } = this

    const styles = isLoading
      ? {
        'min-height': '100px'
      } : {}

    return (
      <div style={ styles } v-loading={ isLoading }>
        { contentSlot }
      </div>
    )
  }
}
