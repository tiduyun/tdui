type ValidatorTrigger = 'click' | 'blur' | 'change'

export interface IValidateRuleItem {
  type?: string;
  message?: string;
  trigger?: ValidatorTrigger;
  required?: boolean;
  min?: number;
  max?: number;
  len?: number;
  validator?: IFunc;
  pattern?: RegExp;
}

export type IValidateRuleObject = Kv<IValidateRuleItem[]>
