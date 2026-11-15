import React from 'react'
import { registerIcon } from 'amis'

const commonReq = require.context('./svg', false, /\.svg$/)
const fileTypeReq = require.context('./svg/filetype', false, /\.svg$/)
const requireAll = (requireContext, prefix='', amisPrefix = '') => {
  requireContext.keys().map(requireContext)
  requireContext.keys().forEach((key) => {
    const name = key.replace(/^\.\/(.*)\.svg$/, '$1')
    // ✅ 直接注册组件，不要用函数包装
    registerIcon(`${amisPrefix}${name}`, (props) => (
      <svg {...props}>
        <use href={`#icon${prefix}-${name}`} />
      </svg>
    ))
  })
}
requireAll(commonReq)
requireAll(fileTypeReq, '-filetype', 'filetype-')