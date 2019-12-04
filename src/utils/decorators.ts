/**
 * Some utility decorators
 *
 * @author Allex Wang (allex.wxn@gmail.com) <http://fedor.io/>
 * MIT Licensed
 */

import {
  debounce as debounceFn,
  decorate,
  nextTick as nextTickFn
} from '@tdio/utils'

const nextTick = decorate((f: IFunc) => function (this: any) {
  const args = arguments
  nextTickFn(() => f.apply(this, <any> args))
})

const debounce = decorate(debounceFn)

export {
  nextTick,
  debounce
}
