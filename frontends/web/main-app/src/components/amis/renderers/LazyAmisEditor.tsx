import React from 'react'
import { LazyComponent } from 'amis-core'
import type { EditorProps } from 'amis-editor-core/lib/component/Editor'

async function load() {
  // @ts-ignore
  await import('../editor/lazyLoader')
  return await import('amis-editor/lib/index')
}

async function loadEditor() {
  const { Editor } = await load()
  return Editor
}

async function loadMiniEditor() {
  const { MiniEditor } = await load()
  return MiniEditor
}

export class Editor extends React.Component<EditorProps> {
  render() {
    // @ts-ignore
    return <LazyComponent childProps={this.props} getComponent={loadEditor} />
  }
}

export class MiniEditor extends React.Component<EditorProps> {
  render() {
    // @ts-ignore
    return <LazyComponent childProps={this.props} getComponent={loadMiniEditor} />
  }
}
