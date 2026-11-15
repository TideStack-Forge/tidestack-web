import { setSchemaTpl, getSchemaTpl } from "amis-editor-core";


setSchemaTpl('tpl:wrapperComponent', {
  name: 'wrapperComponent',
  type: 'select',
  pipeIn: (value: any) => (value === undefined ? '' : value),
  pipeOut: (value: any) => (value === '' ? undefined : value),
  label: '文字格式',
  options: [
    {
      label: '普通文字',
      value: ''
    },
    {
      label: '段落',
      value: 'p'
    },
    {
      label: '一级标题',
      value: 'h1'
    },
    {
      label: '二级标题',
      value: 'h2'
    },
    {
      label: '三级标题',
      value: 'h3'
    },
    {
      label: '四级标题',
      value: 'h4'
    },
    {
      label: '五级标题',
      value: 'h5'
    },
    {
      label: '六级标题',
      value: 'h6'
    },
    {
      label: '富文本',
      value: 'rich-text'
    }
  ],
  onChange: (value: string, oldValue: string, model: any, form: any) => {
    (value === undefined || oldValue === undefined) &&
      form.setValueByName('tpl', '');
  }
});

setSchemaTpl('tpl:content', () =>
  getSchemaTpl('textareaFormulaControl', {
    label: '文字内容',
    mode: 'normal',
    visibleOn: 'this.wrapperComponent === undefined || this.wrapperComponent === ""',
    pipeIn: (value: any, data: any) => value || (data && data.html),
    name: 'tpl'
  })
);

setSchemaTpl('tpl:rich-text', {
  label: '内容',
  type: 'input-rich-text',
  mode: 'normal',
  buttons: [
    'paragraphFormat',
    'quote',
    'textColor',
    'backgroundColor',
    '|',
    'bold',
    'italic',
    'underline',
    'strikeThrough',
    '|',
    'formatOL',
    'formatUL',
    'align',
    '|',
    'insertLink',
    'insertImage',
    'insertTable',
    '|',
    'undo',
    'redo',
    'fullscreen'
  ],
  minRows: 5,
  language: 'html',
  visibleOn: 'this.wrapperComponent === "rich-text"',
  pipeIn: (value: any, data: any) => value || (data && data.html),
  name: 'tpl'
});