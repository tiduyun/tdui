import { CreateElement } from 'vue'
import { Component, Mixins, Prop, Watch } from 'vue-property-decorator'

import { Button } from '../Button'
import ButtonGroupInter from '../Button/ButtonGroup'

import AbsSelectView from './AbsSelectView'

@Component({
  components: { ButtonGroupInter, Button }
})
export default class ButtonGroup extends Mixins(AbsSelectView) {
  render (h: CreateElement) {
    return (
      <ButtonGroupInter value={this.currentValue} props={this.$attrs} onInput={this.handleSelect}>
        {
          this.currentOptions.map(({ value, label }) => <Button key={value} value={value}>{label}</Button>)
        }
      </ButtonGroupInter>
    )
  }
}
