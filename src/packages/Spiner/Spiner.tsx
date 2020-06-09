import { $t } from '@tdio/locale'
import { Loading } from 'element-ui'
import { ElLoadingComponent } from 'element-ui/types/loading'

class Spiner {
  _spiner: ElLoadingComponent | null = null

  start (): ElLoadingComponent {
    let s = this._spiner
    if (!s) {
      s = this._spiner = Loading.service({ background: 'rgba(255, 255, 255, 0.2)', text: $t('Loading...') })
    }
    return s
  }

  stop (): void {
    const s = this._spiner
    if (s) {
      s.close()
      s.$destroy()
      this._spiner = null
    }
  }
}

export { Spiner }

export default new Spiner()
