import { CreateElement } from 'vue'
import { Component, Emit, Prop, Vue, Watch } from 'vue-property-decorator'

@Component
export default class Literal extends Vue {
  @Prop({ type: String, default: '' })
  text!: string

  render (h: CreateElement) {
    return (this.text)
  }
}
