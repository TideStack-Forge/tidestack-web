import { setSchemaTpl, getSchemaTpl } from 'amis-editor'

setSchemaTpl('status', (patch: any) => {
  const schema: any = {
    title: '状态',
    body: [],
  }

  const defaultStatusComponents = [
    { name: 'visible', condition: true },
    { name: 'hidden', condition: true },
    { name: 'clearValueOnHidden', condition: patch?.isFormItem },
    { name: 'static', condition: !patch?.unsupportStatic && patch?.isFormItem },
    { name: 'readonly', condition: patch?.readonly },
    {
      name: 'disabled',
      condition:
        patch?.disabled ||
        (patch?.isFormItem && !schema.body.find((item: any) => item.name === 'disabled')),
    },
  ]
  
  // 添加默认状态组件
  defaultStatusComponents.forEach(({ name, condition }) => {
    if (condition && !schema.body.find((item: any) => item.name === name)) {
      schema.body.push(getSchemaTpl(name))
    }
  })

  // 添加 hasAuth 组件
  if (!schema.body.find((item: any) => item.name === 'hasAuth')) {
    schema.body.push({
      type: 'input-text',
      name: 'hasAuth',
      label: '权限项',
      description: '只有具有该权限时才显示',
    })
  }

  // 添加 hasRole 组件
  if (!schema.body.find((item: any) => item.name === 'hasRole')) {
    schema.body.push({
      type: 'input-text',
      name: 'hasRole',
      label: '角色',
      description: '具有相关角色时才显示，多个角色用英文逗号分隔，多角色时只要当前用户具备任意一个角色即可显示。',
    })
  }

  return schema
})
