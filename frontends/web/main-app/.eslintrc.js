module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier', // 必须放最后; 用于关闭所有与 prettier 冲突的规则
  ],
  parser: '@babel/eslint-parser',
  parserOptions: {
    parser: '@babel/eslint-parser', // 支持实验性语法的lint检测
    requireConfigFile: false,
    babelOptions: {
      parserOpts: {
        plugins: ['jsx'],
      },
    },
  },
  plugins: [
    'jsx-a11y',
    'prettier', // eslint-plugin-prettier 的插件配置，用于格式化代码与 eslint 配合使用
    'react',
    'react-hooks',
  ],
  /**
   * 示例可视化参考：https://alloyteam.github.io/eslint-config-alloy/?hideOff=1&language=zh-CN&rule=vue
   */
  rules: {
    // 生产环境下警告 console 的使用
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',

    // 生产环境下警告 debugger 的使用
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',

    // 是否强制使用 . 访问静态的属性名（否）
    // eg: foo['bar'] 会报错，但是如果方括号中的值是变量，就不会报错
    'dot-notation': 'off',

    // 数组或键值对最后一个元素后面必须有逗号
    'comma-dangle': [
      1,
      {
        arrays: 'always-multiline',
        objects: 'always-multiline',
        imports: 'always-multiline',
        exports: 'always-multiline',
        functions: 'never',
      },
    ],

    'no-undef': 'off',
    'no-template-curly-in-string': 'off',

    '@typescript-eslint/no-var-requires': 0,
    '@typescript-eslint/no-require-imports': 0,
    '@typescript-eslint/no-unused-expressions': 0,
    '@typescript-eslint/no-unused-vars': 'warn',
    // 与 prettier 格式不符时报错
    'prettier/prettier': 'warn',
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: ['plugin:@typescript-eslint/recommended'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 0,
        '@typescript-eslint/explicit-module-boundary-types': 0,
        '@typescript-eslint/no-explicit-any': 0,
        '@typescript-eslint/no-unused-vars': 'warn',
        'object-shorthand': 'warn',
        '@typescript-eslint/ban-ts-comment': 0,
        '@typescript-eslint/no-inferrable-types': 0,
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/no-require-imports': 0,
        '@typescript-eslint/no-unused-expressions': 0,
      },
    },
  ],
}
