type ValidatorTrigger = 'click' | 'blur' | 'change'

type ValidatorFunc = (rule: Kv, value: string | undefined, callback: ICallback) => void

export interface IValidateRuleItem {
  type?: string;
  message?: string;
  trigger?: ValidatorTrigger;
  required?: boolean;
  min?: number;
  max?: number;
  len?: number;
  validator?: ValidatorFunc;
  pattern?: RegExp;
}

export type IValidateRuleObject = Kv<IValidateRuleItem[]>
