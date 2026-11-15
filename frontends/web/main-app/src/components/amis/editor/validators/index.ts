import {
  registerValidator as registerValidators,
  ValidationGroup,
  ValidatorTag,
} from 'amis-editor/lib/validator'

import type { Validator } from 'amis-editor/lib/validator'

enum ValidTagMatchType {
  isDefault = 1, // 默认推荐，可以直接操作开关
  isMore = 2, // 默认不推荐，可以通过更多添加规则来进行设置，不可操作开关
  isBuiltIn = 3, // 默认内置校验， 默认开启，不可操作开关关闭
}

registerValidators(
  {
    label: '与指定值不同',
    name: 'notEquals',
    group: ValidationGroup.Others,
    message: '输入的数据不能与 \\$1 一致',
    tag: {
      [ValidatorTag.All]: ValidTagMatchType.isMore,
    },
    schema: [
      {
        type: 'input-text',
        name: 'value',
        label: '值内容',
      },
    ],
  },
  {
    label: '与指定字段值不同',
    name: 'notEqualsField',
    group: ValidationGroup.Others,
    message: '输入的数据不能与 \\$1 的值一致',
    tag: {
      [ValidatorTag.All]: ValidTagMatchType.isMore,
    },
    schema: [
      {
        type: 'input-text',
        name: 'value',
        label: '字段名',
      },
    ],
  },
  {
    label: '不在列表中',
    name: 'notIn',
    group: ValidationGroup.Pattern,
    message: '输入的数据不能在列表中',
    tag: {
      [ValidatorTag.All]: ValidTagMatchType.isMore,
    },
    schema: [
      {
        type: 'input-array',
        name: 'value',
        placeholder: '列表',
        items: {
          type: 'input-text',
          placeholder: '输入项',
        },
        value: [],
      },
    ],
  },
  ...Array(5)
    .fill(null)
    .map((v, index): Validator => {
      const num = index === 0 ? '' : index
      return {
        label: '自定义正则' + num + '（不匹配）',
        name: 'notMatchRegexp' + num,
        group: ValidationGroup.Regex,
        message: '格式不正确, 数据不能与 \\$1 相匹配。',
        tag: {
          [ValidatorTag.All]: ValidTagMatchType.isMore,
        },
        schema: [
          {
            type: 'input-text',
            name: 'value',
            label: '表达式',
            placeholder: '请输入Js正则',
            prefix: '/',
            suffix: '/',
          },
        ],
      }
    })
)

export function registerValidator(validator: Validator) {
  registerValidators(validator)
}

export { registerValidators }