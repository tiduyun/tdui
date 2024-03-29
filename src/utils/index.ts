import { decode as b64Decode, encode as b64Encode } from '@allex/base64'
import { isFunction } from '@tdio/utils'

export {
  b64Decode, b64Encode
}

export function parseBase64 <T = any> (s: string): T {
  return JSON.parse(b64Decode(s))
}

export function toBase64 <T> (o: T): string {
  let s = o as any as string
  if (typeof o !== 'string') {
    s = JSON.stringify(o)
  }
  return b64Encode(s, true)
}

export interface ITruncateOption {
  textLength?: number;
  isUnicodeLength?: boolean;
}

/*
 * Calculate the byte lengths for utf8 encoded strings.
 */
export function byteLength (str: string | { toString (): string; [x: string]: any }): number {
  if (!str) {
    return 0
  }

  str = str.toString()
  let len = str.length

  for (let i = str.length; i--;) {
    const code = str.charCodeAt(i)
    if (code >= 0xdc00 && code <= 0xdfff) {
      i--
    }

    if (code > 0x7f && code <= 0x7ff) {
      len++
    } else if (code > 0x7ff && code <= 0xffff) {
      len += 2
    }
  }

  return len
}

export function truncate (s: string, option: ITruncateOption = {}) {
  const l = option.isUnicodeLength ? byteLength(s) : s.length
  const textLength = option.textLength || 12
  let truncateStr = s
  if (l > textLength) {
    truncateStr = s.substr(0, textLength)
    if (truncateStr.length < s.length) {
      truncateStr += '...'
    }
  }
  return truncateStr
}

export function parseClass (className: string): Kv<boolean> {
  className = className || ''
  const classArr = className.trim().split(' ')
  const classItems = classArr.reduce((item: Kv, val) => {
    if (val) {
      item[val] = true
    }
    return item
  }, {})
  return classItems
}

export const result = <T> (o: T, ...args: any[]) => (typeof o === 'function' ? o(...args) : o)

/**
 * Ensure the provided object is a promise
 *
 * @param o
 * @returns
 */
export const toPromise = <T> (o: any): Promise<T> => {
  if (isFunction(o?.catch)) {
    return o as Promise<T>
  } else {
    if (o instanceof Error) {
      return Promise.reject(o)
    }
    return Promise.resolve(o)
  }
}
