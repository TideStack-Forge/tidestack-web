import babel from '@rollup/plugin-babel'
import fs from 'node:fs'
import dts from 'rollup-plugin-dts'
import typescript from 'rollup-plugin-typescript2'

const cleanOutput = () => ({
  name: 'clean-output',
  buildStart() {
    fs.rmSync(new URL('./esm', import.meta.url), { recursive: true, force: true })
  },
})

export default [
  {
    input: { index: 'src/main.ts', lifecycle: 'src/lifecycle.ts' }, // index 对应 main.ts
    output: [
      {
        dir: 'esm', // 输出目录
        format: 'esm', // 将软件包保存为 ES 模块文件
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
      },
    ],
    watch: {
      // 配置监听处理
      exclude: 'node_modules/**',
    },
    plugins: [
      cleanOutput(),
      typescript(),
      // 使用插件 @rollup/plugin-babel
      babel({
        babelHelpers: 'bundled',
        exclude: 'node_modules/**',
      }),
    ],
  },
  {
    input: { index: 'src/main.ts', lifecycle: 'src/lifecycle.ts' }, // 入口文件
    // 生成类型文件
    output: [
      {
        dir: 'esm', // 输出目录
        format: 'esm', // 将软件包保存为 ES 模块文件
      },
    ],
    // dts插件使用
    plugins: [dts()],
  },
]
