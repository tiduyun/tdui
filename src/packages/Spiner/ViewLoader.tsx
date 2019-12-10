import { CreateElement, VNode } from 'vue'
import { Component, Prop, Vue } from 'vue-property-decorator'

@Component({
  componentName: 'ViewLoader'
})
export class ViewLoader extends Vue {
  isLoading: boolean = false

  created () {
    const timer = setTimeout(() => {
      this.isLoading = true
    }, 10)

    this.$on('response', (resData: { isLoading: boolean; }) => {
      clearTimeout(timer)
      this.isLoading = resData.isLoading || false
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
