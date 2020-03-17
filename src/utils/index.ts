import { decode as b64Decode, encode as b64Encode } from '@allex/base64'

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
  s = s.replace(/</g, '&lt;').replace(/>/g, '&gt;')
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
