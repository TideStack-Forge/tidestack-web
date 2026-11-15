import { addRule } from 'amis'
function notMatch(values: any, value: string, regex?: string | RegExp) {
  if (!value || !regex) {
    return true
  }
  if (typeof regex === 'string') {
    regex = new RegExp(regex)
  }
  return !regex.test(value)
}

addRule('notMatchRegexp', notMatch, '格式不正确, 数据不能与 `$1` 相匹配。')
addRule('notMatchRegexp1', notMatch, '格式不正确, 数据不能与 `$1` 相匹配。')
addRule('notMatchRegexp2', notMatch, '格式不正确, 数据不能与 `$1` 相匹配。')
addRule('notMatchRegexp3', notMatch, '格式不正确, 数据不能与 `$1` 相匹配。')
addRule('notMatchRegexp4', notMatch, '格式不正确, 数据不能与 `$1` 相匹配。')
addRule('notMatch', notMatch, '格式不正确, 数据不能与 `$1` 相匹配。')
addRule('notMatch1', notMatch, '格式不正确, 数据不能与 `$1` 相匹配。')
addRule('notMatch2', notMatch, '格式不正确, 数据不能与 `$1` 相匹配。')
addRule('notMatch3', notMatch, '格式不正确, 数据不能与 `$1` 相匹配。')
addRule('notMatch4', notMatch, '格式不正确, 数据不能与 `$1` 相匹配。')
