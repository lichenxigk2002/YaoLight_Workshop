import { md5 } from 'js-md5';

/**
 * MD5 加密
 * @param text 要加密的文本
 * @returns MD5 加密后的字符串
 */
export function md5Hash(text: string): string {
  return md5(text);
}

