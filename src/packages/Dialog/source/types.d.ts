import { IValidateRuleObject } from '../../../../types/validate'

type IGenericAction<A, T> = (arg1?: A) => Promise<T>

export interface IDialogModel<T = any> extends Kv {
  data?: T;
  visible?: boolean;
  rules?: IValidateRuleObject;
  onSubmit?: IGenericAction<Event, any>;
}
