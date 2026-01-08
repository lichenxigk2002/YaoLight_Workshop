/**
 * 验证字符串是否为有效的 JSON 格式
 * @param str 要验证的字符串
 * @returns 如果是有效的 JSON 返回 true，否则返回 false
 */
export const isValidJson = (str: string): boolean => {
  if (!str || str.trim() === '') {
    return true; // 空字符串视为有效（可选填）
  }
  try {
    const result = JSON.parse(str);
    // 确保解析结果是对象而不是数字、布尔值等简单类型（针对Headers和Cookies场景）
    return typeof result === 'object' && result !== null;
  } catch (e) {
    return false;
  }
};

/**
 * Ant Design Form 验证规则
 * @param message 错误提示信息
 * @returns Form.Item rules 对象
 */
export const jsonValidatorRule = (message: string = '请输入有效的 JSON 格式') => ({
  validator: (_: any, value: string) => {
    if (isValidJson(value)) {
      return Promise.resolve();
    }
    return Promise.reject(new Error(message));
  },
});
