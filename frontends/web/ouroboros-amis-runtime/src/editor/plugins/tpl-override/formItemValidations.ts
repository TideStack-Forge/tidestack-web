import { setSchemaTpl, isObject, getI18nEnabled } from 'amis-editor'
import { str2rules } from 'amis'
import find from 'lodash/find'

setSchemaTpl('validations', function () {
  const options = [
    // {
    //     label: '必填',
    //     value: 'isRequired'
    // },
    {
      label: '邮箱格式',
      value: 'isEmail',
    },
    {
      label: 'Url格式',
      value: 'isUrl',
    },
    {
      label: '数字',
      value: 'isNumeric',
    },
    {
      label: '字母',
      value: 'isAlpha',
    },
    {
      label: '字母和数字',
      value: 'isAlphanumeric',
    },
    {
      label: '整型数字',
      value: 'isInt',
    },
    {
      label: '浮点型数字',
      value: 'isFloat',
    },
    {
      label: '固定长度',
      value: 'isLength',
    },
    {
      label: '最大长度',
      value: 'maxLength',
    },
    {
      label: '最小长度',
      value: 'minLength',
    },
    {
      label: '最大值',
      value: 'maximum',
    },
    {
      label: '最小值',
      value: 'minimum',
    },
    {
      label: '手机号码',
      value: 'isPhoneNumber',
    },
    {
      label: '电话号码',
      value: 'isTelNumber',
    },
    {
      label: '邮编号码',
      value: 'isZipcode',
    },
    {
      label: '身份证号码(18/15位)',
      value: 'isId',
    },
    {
      label: '身份证号码(18位)',
      value: 'isId18',
    },
    {
      label: 'JSON格式',
      value: 'isJson',
    },
    {
      label: '与指定值相同',
      value: 'equals',
    },
    {
      label: '与指定字段值相同',
      value: 'equalsField',
    },
    {
      label: '与指定值不同',
      value: 'notEquals',
    },
    {
      label: '与指定字段值不同',
      value: 'notEqualsField',
    },
    {
      label: '不在列表中',
      value: 'notIn',
    },
    {
      label: '自定义正则',
      value: 'matchRegexp',
    },
    {
      label: '自定义正则2',
      value: 'matchRegexp1',
    },
    {
      label: '自定义正则3',
      value: 'matchRegexp2',
    },
    {
      label: '自定义正则4',
      value: 'matchRegexp3',
    },
    {
      label: '自定义正则5',
      value: 'matchRegexp4',
    },
    {
      label: '自定义正则（不匹配）',
      value: 'notMatchRegexp',
    },
    {
      label: '自定义正则2（不匹配）',
      value: 'notMatchRegexp1',
    },
    {
      label: '自定义正则3（不匹配）',
      value: 'notMatchRegexp2',
    },
    {
      label: '自定义正则4（不匹配）',
      value: 'notMatchRegexp3',
    },
    {
      label: '自定义正则5（不匹配）',
      value: 'notMatchRegexp4',
    },
  ]

  const trueProps = [
    'isEmail',
    'isUrl',
    'isNumeric',
    'isAlpha',
    'isAlphanumeric',
    'isInt',
    'isFloat',
    'isJson',
    'isPhoneNumber',
    'isTelNumber',
    'isZipcode',
    'isId',
  ]

  function firstValue(arr: Array<any>, iterator: (item: any) => any) {
    const theone = find(arr, iterator)
    return theone ? theone.value : ''
  }

  return {
    type: 'combo',
    syncDefaultValue: false,
    name: 'validations',
    label: '验证规则',
    addButtonText: '新增规则',
    multiple: true,
    pipeIn: (value: any) => {
      if (typeof value === 'string' && value) {
        value = str2rules(value)
      }
      if (!isObject(value)) {
        return value
      }

      const arr: Array<any> = []

      Object.keys(value).forEach((key) => {
        if (/^\$\$/.test(key)) {
          return
        }

        arr.push({
          type: key,
          [key]: Array.isArray(value[key]) ? value[key][0] : value[key],
        })
      })

      return arr
    },
    pipeOut: (value: any) => {
      if (!Array.isArray(value)) {
        return value
      }
      const obj: any = {}

      value.forEach((item: any) => {
        const key: string =
          item.type ||
          firstValue(options, (item: any) => !obj[item.value]) ||
          options[0].value
        obj[key] = item[key] || (~trueProps.indexOf(key) ? true : '')
      })

      return obj
    },
    items: [
      {
        type: 'select',
        unique: true,
        name: 'type',
        options: options,
        columnClassName: 'w-sm',
      },
      {
        type: 'input-number',
        name: 'isLength',
        visibleOn: 'this.type == "isLength"',
        placeholder: '设置长度',
        value: '1',
      },
      {
        type: 'input-number',
        name: 'maximum',
        visibleOn: 'this.type == "maximum"',
        placeholder: '设置最大值',
      },
      {
        type: 'input-number',
        name: 'minimum',
        visibleOn: 'this.type == "minimum"',
        placeholder: '设置最小值',
      },
      {
        type: 'input-number',
        name: 'maxLength',
        visibleOn: 'this.type == "maxLength"',
        placeholder: '设置最大长度值',
      },
      {
        type: 'input-number',
        name: 'minLength',
        visibleOn: 'this.type == "minLength"',
        placeholder: '设置最小长度值',
      },
      {
        type: 'input-text',
        name: 'equals',
        visibleOn: 'this.type == "equals"',
        placeholder: '设置值',
        value: '',
      },
      {
        type: 'input-text',
        name: 'equalsField',
        visibleOn: 'this.type == "equalsField"',
        placeholder: '设置字段名',
        value: '',
      },
      {
        type: 'input-text',
        name: 'notEquals',
        visibleOn: 'this.type == "notEquals"',
        placeholder: '设置值',
        value: '',
      },
      {
        type: 'input-text',
        name: 'notEqualsField',
        visibleOn: 'this.type == "notEqualsField"',
        placeholder: '设置字段名',
        value: '',
      },
      {
        type: 'input-array',
        name: 'notIn',
        visibleOn: 'this.type == "notIn"',
        placeholder: '列表',
        items: {
          type: 'input-text',
          placeholder: '输入项',
        },
        value: [],
      },
      {
        type: 'input-text',
        name: 'matchRegexp',
        visibleOn: 'this.type == "matchRegexp"',
        placeholder: '设置正则规则',
      },
      {
        type: 'input-text',
        name: 'matchRegexp1',
        visibleOn: 'this.type == "matchRegexp1"',
        placeholder: '设置正则规则',
      },
      {
        type: 'input-text',
        name: 'matchRegexp2',
        visibleOn: 'this.type == "matchRegexp2"',
        placeholder: '设置正则规则',
      },
      {
        type: 'input-text',
        name: 'matchRegexp3',
        visibleOn: 'this.type == "matchRegexp3"',
        placeholder: '设置正则规则',
      },
      {
        type: 'input-text',
        name: 'matchRegexp4',
        visibleOn: 'this.type == "matchRegexp4"',
        placeholder: '设置正则规则',
      },
      {
        type: 'input-text',
        name: 'notMatchRegexp',
        visibleOn: 'this.type == "notMatchRegexp"',
        placeholder: '设置正则规则',
      },
      {
        type: 'input-text',
        name: 'notMatchRegexp1',
        visibleOn: 'this.type == "notMatchRegexp1"',
        placeholder: '设置正则规则',
      },
      {
        type: 'input-text',
        name: 'notMatchRegexp2',
        visibleOn: 'this.type == "notMatchRegexp2"',
        placeholder: '设置正则规则',
      },
      {
        type: 'input-text',
        name: 'notMatchRegexp3',
        visibleOn: 'this.type == "notMatchRegexp3"',
        placeholder: '设置正则规则',
      },
      {
        type: 'input-text',
        name: 'notMatchRegexp4',
        visibleOn: 'this.type == "notMatchRegexp4"',
        placeholder: '设置正则规则',
      },
    ],
  }
})

setSchemaTpl('validationErrors', function () {
  const i18nEnabled = getI18nEnabled()
  const options = [
    // {
    //     label: '必填',
    //     value: 'isRequired'
    // },
    {
      label: '邮箱格式',
      value: 'isEmail',
    },
    {
      label: 'Url格式',
      value: 'isUrl',
    },
    {
      label: '数字',
      value: 'isNumeric',
    },
    {
      label: '字母',
      value: 'isAlpha',
    },
    {
      label: '字母和数字',
      value: 'isAlphanumeric',
    },
    {
      label: '整型数字',
      value: 'isInt',
    },
    {
      label: '浮点型数字',
      value: 'isFloat',
    },
    {
      label: '固定长度',
      value: 'isLength',
    },
    {
      label: '最大长度',
      value: 'maxLength',
    },
    {
      label: '最小长度',
      value: 'minLength',
    },
    {
      label: '最大值',
      value: 'maximum',
    },
    {
      label: '最小值',
      value: 'minimum',
    },
    {
      label: 'JSON格式',
      value: 'isJson',
    },
    {
      label: '手机号码',
      value: 'isPhoneNumber',
    },
    {
      label: '电话号码',
      value: 'isTelNumber',
    },
    {
      label: '邮编号码',
      value: 'isZipcode',
    },
    {
      label: '身份证号码',
      value: 'isId',
    },
    {
      label: '与指定值相同',
      value: 'equals',
    },
    {
      label: '与指定字段值相同',
      value: 'equalsField',
    },
    {
      label: '与指定值不同',
      value: 'notEquals',
    },
    {
      label: '与指定字段值不同',
      value: 'notEqualsField',
    },
    {
      label: '不在列表中',
      value: 'notIn',
    },
    {
      label: '自定义正则',
      value: 'matchRegexp',
    },
    {
      label: '自定义正则2',
      value: 'matchRegexp1',
    },
    {
      label: '自定义正则3',
      value: 'matchRegexp2',
    },
    {
      label: '自定义正则4',
      value: 'matchRegexp3',
    },
    {
      label: '自定义正则5',
      value: 'matchRegexp4',
    },
    {
      label: '自定义正则（不匹配）',
      value: 'notMatchRegexp',
    },
    {
      label: '自定义正则2（不匹配）',
      value: 'notMatchRegexp1',
    },
    {
      label: '自定义正则3（不匹配）',
      value: 'notMatchRegexp2',
    },
    {
      label: '自定义正则4（不匹配）',
      value: 'notMatchRegexp3',
    },
    {
      label: '自定义正则5（不匹配）',
      value: 'notMatchRegexp4',
    },
  ]

  const defaultMessages = {
    isEmail: 'Email 格式不正确',
    isRequired: '这是必填项',
    isUrl: 'Url 格式不正确',
    isInt: '请输入整形数字',
    isAlpha: '请输入字母',
    isNumeric: '请输入数字',
    isAlphanumeric: '请输入字母或者数字',
    isFloat: '请输入浮点型数值',
    isWords: '请输入字母',
    isUrlPath: '只能输入字母、数字、`-` 和 `_`.',
    matchRegexp: '格式不正确, 请输入符合规则为 `$1` 的内容。',
    notMatchRegexp: '格式不正确, 数据不能与 `$1` 相匹配。',
    minLength: '请输入更多的内容，至少输入 $1 个字符。',
    maxLength: '请控制内容长度, 请不要输入 $1 个字符以上',
    maximum: '当前输入值超出最大值 $1，请检查',
    minimum: '当前输入值低于最小值 $1，请检查',
    isJson: '请检查 Json 格式。',
    isPhoneNumber: '请输入合法的手机号码',
    isTelNumber: '请输入合法的电话号码',
    isZipcode: '请输入合法的邮编地址',
    isId: '请输入合法的身份证号',
    isLength: '请输入长度为 $1 的内容',
    notEmptyString: '请不要全输入空白字符',
    equalsField: '输入的数据与 $1 值不一致',
    equals: '输入的数据与 $1 不一致',
    notEqualsField: '输入的数据与 $1 值不一致',
    notEquals: '输入的数据与 $1 不一致',
    notIn: '输入的数据不能在列表中',
  }

  function firstValue(arr: Array<any>, iterator: (item: any) => any) {
    const theone = find(arr, iterator)
    return theone ? theone.value : ''
  }

  return {
    type: 'combo',
    syncDefaultValue: false,
    name: 'validationErrors',
    label: '自定义验证提示',
    description: '自带提示不满足时，可以自定义。',
    addButtonText: '新增提示',
    multiple: true,
    pipeIn: (value: any) => {
      if (!isObject(value)) {
        return value
      }

      const arr: Array<any> = []

      Object.keys(value).forEach((key) => {
        if (/^\$\$/.test(key)) {
          return
        }

        arr.push({
          type: key,
          msg: value[key],
        })
      })

      return arr
    },
    pipeOut: (value: any) => {
      if (!Array.isArray(value)) {
        return value
      }
      const obj: any = {}

      value.forEach((item: any) => {
        const key: string =
          item.type ||
          firstValue(options, (item: any) => !obj[item.value]) ||
          options[0].value
        obj[key] = item.msg || (defaultMessages as any)[key] || ''
      })

      return obj
    },
    items: [
      {
        type: 'select',
        unique: true,
        name: 'type',
        options: options,
        columnClassName: 'w-sm',
      },

      {
        type: i18nEnabled ? 'input-text-i18n' : 'input-text',
        name: 'msg',
        placeholder: '提示信息',
      },

      {
        type: 'formula',
        name: 'msg',
        initSet: false,
        formula: `(${JSON.stringify(defaultMessages)})[data.type] || ''`,
      },
    ],
  }
})
