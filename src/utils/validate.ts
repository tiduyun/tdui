import {
  get, hasOwn, isEmpty, isFunction, isObject, isValue, set
} from '@tdio/utils'

import { IValidateRuleItem } from '../../types/validate'

export type IValidatePredicate = (v: any) => boolean

export type IValidatorFunc = (rule: IValidateRuleItem & { field?: string; }, value: any, callback: ICallback, source?: any, options?: Kv) => void

export type IValidateRuleArgs = Partial<IValidateRuleItem> & {
  min?: number;
  max?: number;
}

export interface IValidatePredicateItem {
  predicate: IValidatePredicate;
  message: string;
}

export type IValidatorConfig = IValidatePredicateItem | IValidateRuleItem

const result = (o: any, ...args: any[]) => (typeof o === 'function' ? o(...args) : o)

export const createRegExp = (s: string, pattern: '' | 'i' | 'g' | 'm' = '') => new RegExp(s, pattern)

export const createValidator = (
  predicate: IValidatePredicate,
  message: string = ''
): IValidatorFunc => (rule, value, callback, source, _options) => {
  const errors = []
  const validate = rule.required || !rule.required && hasOwn(source, rule.field!)

  if (validate) {
    if (isEmpty(value) && !rule.required) {
      callback()
      return
    }
    if (!predicate(value)) {
      errors.push(message || rule.message)
    }
  }

  callback(errors)
}

type IValidateConfigType = IValidatePredicate | RegExp | IValidateRuleItem

const normalizeValidateRule = (v: IValidateConfigType, ruleArgs: IValidateRuleArgs): IValidateRuleItem => {
  const r = result(v, ruleArgs)

  let o: IValidateRuleItem | undefined

  if (isFunction(r)) {
    o = {
      ...ruleArgs,
      validator: createValidator(r as IValidatePredicate, ruleArgs.message)
    }
  } else if (r instanceof RegExp) {
    o = {
      ...ruleArgs,
      pattern: r as RegExp
    }
  } else {
    o = r as IValidateRuleItem
  }

  return o
}

const ruleCache: Kv<IValidateConfigType> = {}

export const registerValidateConfig = (name: string | Kv<IValidatorConfig>, impl?: IValidatorConfig) => {
  // batch registion
  if (isObject(name)) {
    const o = name as Kv<IValidatorConfig>
    Object.keys(o).forEach(k => registerValidateConfig(k, o[k]))
  } else if (isValue(impl)) {
    const key = name as string
    const { predicate, message } = impl as IValidatePredicateItem
    if (isFunction(predicate)) {
      set(ruleCache, key, {
        validator: createValidator(predicate, message)
      })
    } else {
      set(ruleCache, key, impl as IValidateRuleItem)
    }
  }
}

export const getRule = (
  type: string,
  message: string | IValidateRuleArgs = '',
  trigger: string = 'change'
): IValidateRuleItem => {
  let args: IValidateRuleArgs

  if (isObject(message)) {
    args = message as IValidateRuleArgs
  } else {
    args = {
      message: message as string,
      trigger
    }
  }

  const raw = get<IValidateConfigType>(ruleCache, type)
  if (!raw) {
    throw new Error(`The specified validate schema not found: ${type}`)
  }

  return normalizeValidateRule(raw, args)
}
