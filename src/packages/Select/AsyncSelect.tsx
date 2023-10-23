import { Component, Mixins, Prop, Watch } from 'vue-property-decorator'

import { IOption } from '@/types/common'

import { toPromise } from '../../utils'
import { CancelablePromise, makeCancelablePromise } from '../../utils/CancelablePromise'
import { IOptionEntity } from './AbsSelectView'
import Select from './Select'

type IOptionsLoader = (...args: any[]) => Promise<IOptionEntity[]>

@Component({
  name: 'AsyncSelect',
  inheritAttrs: false
})
export class AsyncSelect extends Mixins(Select) {
  @Prop(Boolean)
  loading!: boolean

  private _cacheKey: string | undefined = undefined
  private _optionsPromise: CancelablePromise<IOptionEntity[]> | undefined = undefined
  private _optionLoader: IOptionsLoader | undefined = undefined
  private _lastParams: any = undefined

  @Watch('loading')
  setLoading (v: boolean): void {
    this.selectProps = {
      ...this.selectProps,
      inputLoading: v
    }
    this.$emit('update:loading', v)
  }

  load (params?: Kv): Promise<IOption[]> {
    const ld = this._optionLoader
    if (ld) {
      this._lastParams = params
      return this.setOptions(ld)
    }
    return Promise.reject(new Error('Select options not provide'))
  }

  /**
   * Implement a interceptor for options loader (provide cancelable and ui locker etc)
   *
   * @override
   *
   * @param loader
   * @returns
   */
  optionsDecorator (loader: IOptionsLoader): Promise<IOptionEntity[]> {
    const prev = this._optionsPromise
    if (prev) {
      prev.cancel()
    }

    // lock ui
    this.setLoading(true)

    // cache the loader ref for #.load(...) manually
    this._optionLoader = loader

    const optionsPromise = makeCancelablePromise(toPromise<IOptionEntity[]>(loader(this._lastParams)))
    this._optionsPromise = optionsPromise

    return optionsPromise.promise.finally(() => {
      this.setLoading(false)
    })
  }
}
