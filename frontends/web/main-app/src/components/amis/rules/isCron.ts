import { addRule } from 'amis'
const defaultDialect = 'unix'
const cronValidators = {
  linux: validateUnixCron,
  unix: validateUnixCron,
  quartz: validateQuartzCron,
  spring: validateSpringCron,
  kubernetes: validateUnixCron,
  k8s: validateUnixCron,
} as {
  [key: string]: (cron: string) => boolean | { error: boolean; msg?: string | undefined }
}

const weekdaysSundayFirst = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const weekdaysMondayFirst = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const months = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
]

function isCron(
  values: any,
  value: string,
  dialect?: string | boolean
): boolean | { error: boolean; msg?: string | undefined } {
  if (!value || dialect === false) {
    return true
  }
  const finalDialect = (
    typeof dialect === 'string' ? dialect : defaultDialect
  ).toLowerCase()
  const validator = cronValidators[finalDialect] ?? cronValidators[defaultDialect]
  return validator(value)
}

function validateUnixCron(
  cron: string
): boolean | { error: boolean; msg?: string | undefined } {
  const parts = cron.split(' ')
  if (parts.length !== 5)
    return { error: true, msg: 'Unix/Linux/k8s相兼容的cron表达式字段数应为5个' }

  const ruleSet = [
    { min: 0, max: 59, allowStar: true, allowList: true, partName: '分钟' },
    { min: 0, max: 23, allowStar: true, allowList: true, partName: '小时' },
    { min: 1, max: 31, allowStar: true, allowList: true, partName: '日期' },
    { min: 1, max: 12, allowStar: true, allowList: true, partName: '月份' },
    { min: 0, max: 6, allowStar: true, allowList: true, partName: '星期' },
  ]

  // 检查基本格式
  return validateRuleSet(parts, ruleSet)
}

function validateQuartzCron(
  cron: string
): boolean | { error: boolean; msg?: string | undefined } {
  const parts = cron.split(' ')
  if (parts.length !== 6 && parts.length !== 7) {
    return { error: true, msg: 'Quartz cron表达式字段数应为6-7个' }
  }
  const ruleSet = [
    { min: 0, max: 59, allowStar: true, allowList: true, partName: '秒' },
    { min: 0, max: 59, allowStar: true, allowList: true, partName: '分钟' },
    { min: 0, max: 23, allowStar: true, allowList: true, partName: '小时' },
    {
      min: 1,
      max: 31,
      allowStar: true,
      allowList: true,
      partName: '日期',
      specialCharts: ['?', 'LW', 'L'],
      specialPattern: [/^\d{1,2}W$/, /^L-\d{1,2}$/],
    },
    {
      min: 1,
      max: 12,
      allowStar: true,
      allowList: true,
      partName: '月份',
      namedList: months,
    },
    {
      min: 1,
      max: 7,
      allowStar: true,
      allowList: true,
      partName: '星期',
      namedList: weekdaysSundayFirst,
      specialCharts: ['?'],
      specialPattern: [/^[1-7]L$/, /^[1-7]#[1-5]/],
    },
    {
      min: 1970,
      max: 2099,
      allowStar: true,
      allowList: true,
      partName: '年',
    },
  ]

  const ruleSetVaidateResult = validateRuleSet(parts, ruleSet)
  if (ruleSetVaidateResult !== true) {
    return ruleSetVaidateResult
  }
  return validateDayWeekDay(parts)
}

function validateSpringCron(
  cron: string
): boolean | { error: boolean; msg?: string | undefined } {
  const parts = cron.split(' ')
  if (parts.length !== 6) {
    return { error: true, msg: 'Spring cron表达式字段数应为6个' }
  }

  const ruleSet = [
    { min: 0, max: 59, allowStar: true, allowList: true, partName: '秒' },
    { min: 0, max: 59, allowStar: true, allowList: true, partName: '分钟' },
    { min: 0, max: 23, allowStar: true, allowList: true, partName: '小时' },
    { min: 1, max: 31, allowStar: true, allowList: true, partName: '日期' },
    {
      min: 1,
      max: 12,
      allowStar: true,
      allowList: true,
      partName: '月份',
      namedList: months,
    },
    {
      min: 1,
      max: 7,
      allowStar: true,
      allowList: true,
      partName: '星期',
      namedList: weekdaysMondayFirst,
    },
  ]

  const ruleSetVaidateResult = validateRuleSet(parts, ruleSet)

  if (ruleSetVaidateResult !== true) {
    return ruleSetVaidateResult
  }

  return validateDayWeekDay(parts)
}

function validateRuleSet(
  parts: string[],
  ruleSet: any[]
): boolean | { error: boolean; msg?: string | undefined } {
  for (let i = 0; i < ruleSet.length; i++) {
    const {
      min,
      max,
      allowStar,
      allowList,
      partName,
      namedList,
      specialCharts,
      specialPattern,
    } = ruleSet[i]
    if (i > parts.length - 1) continue
    const part = parts[i]
    if (specialCharts && specialCharts.includes(part)) continue
    if (specialPattern && specialPattern.some((pattern: RegExp) => pattern.test(part)))
      continue
    const validateResult = validatePart(part, min, max, allowStar, allowList, namedList)
    if (!validateResult) {
      return { error: true, msg: `${partName}部分格式错误` }
    }
  }

  return true
}

function validatePart(
  part: string,
  min: number,
  max: number,
  allowStar: boolean,
  allowList: boolean,
  namedList?: string[]
) {
  if (allowStar && part === '*') {
    return true
  }
  if (namedList && namedList.length) {
    const offset = 0 - min
    namedList.forEach((name, index) => {
      const numValue = index + offset
      part = part.replaceAll(name, `${numValue}`)
    })
  }
  if (part.includes(',')) {
    if (!allowList) return false
    const list = part.split(',').map((item) => {
      const str = item.trim()
      // 先检查是否都是数字
      if (!str.match(/^\d+$/)) return NaN
      // 再转成数字
      return Number(str)
    })
    if (list.includes(NaN)) return false
    if (list.some((item) => item < min || item > max)) return false
  }
  if (part.includes('-')) {
    const [start, end] = part.split('-').map((item) => {
      const str = item.trim()
      // 先检查是否都是数字
      if (!str.match(/^\d+$/)) return NaN
      // 再转成数字
      return Number(str)
    })
    if (start < min || end > max || start > end) return false
  }
  if (part.includes('/')) {
    const [start, step] = part.split('/').map((item) => {
      const str = item.trim()
      // 先检查是否都是数字
      if (!str.match(/^\d+$/)) return NaN
      // 再转成数字
      return Number(str)
    })
    if ((!Number.isNaN(start) && start < min) || step < 1 || step > max) return false
  }
  if (part.match(/^\d+$/)) {
    const num = Number(part)
    if (num < min || num > max) return false
  }
  return true
}

function validateDayWeekDay(
  parts: string[]
): boolean | { error: boolean; msg?: string | undefined } {
  const day = parts[3]
  const week = parts[5]
  if (day === '?' && week === '?') return { error: true, msg: '日期和星期不能同时为"?"' }
  if (day !== '?' && week !== '?')
    return { error: true, msg: '日期和星期必须有一个为"?"' }
  return true
}

addRule('isCron', isCron, 'cron表达式格式错误')
