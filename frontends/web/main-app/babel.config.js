module.exports = {
  presets: [
    ['@babel/preset-env', { bugfixes: true }],
    ['@babel/preset-typescript', { allExtensions: true, isTSX: true }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    ['@babel/plugin-transform-class-properties', { loose: true }],
    ['@babel/plugin-transform-private-methods', { loose: true }],
    ['@babel/plugin-transform-private-property-in-object', { loose: true }],
  ],
}
