import React from 'react'
import { loadMicroApp } from 'qiankun'
import { FormItem, Renderer } from 'amis'
import { normalizeMicroEntry } from '@/common/micro/utils'
import { getCommonProps } from '@/common/micro/commonProps'
import {
  createMicroEntryFetch,
  ensureSameOriginMicroEntryIsSafe,
} from '@/common/micro/entryGuard'
class customAppRender extends React.Component<any, any> {
  domRef: React.RefObject<HTMLDivElement>
  microApp: any
  destroyed = false
  constructor(props: any) {
    super(props)
    this.domRef = React.createRef()
    this.microApp = null
    this.state = {
      loading: true,
    }
  }

  componentDidMount() {
    this.destroyed = false
    void this.mountMicroApp()
  }

  async mountMicroApp() {
    const { entry } = this.props
    const commonProps = getCommonProps()
    if (!entry) {
      this.setState({
        loading: false,
      })
      return
    }

    const normalizedEntry = normalizeMicroEntry(entry)
    const appConfig: any = {
      name: `micro-component-${new Date().getTime()}-${Math.random()}`,
      container: this.domRef.current,
      entry: normalizedEntry,
      props: {
        ...commonProps,
        ...this.props,
      },
    }

    try {
      await ensureSameOriginMicroEntryIsSafe(normalizedEntry)
      if (this.destroyed) {
        return
      }

      this.microApp = loadMicroApp(appConfig, {
        sandbox: {
          experimentalStyleIsolation: true,
        },
        fetch: createMicroEntryFetch(),
      })
      await this.microApp.mountPromise
    } catch (error) {
      if (!(error as any)?.isUnsafeMicroEntry) {
        console.warn('微组件加载失败', error)
      }
    } finally {
      if (!this.destroyed) {
        this.setState({
          loading: false,
        })
      }
    }
  }

  componentWillUnmount() {
    this.destroyed = true
    this.microApp && this.microApp.unmount()
  }

  componentDidUpdate() {
    const commonProps = getCommonProps()
    if (this.microApp && this.microApp.update) {
      this.microApp.update({ ...commonProps, ...this.props })
    }
  }

  render() {
    const { className, inputStyle, classnames: cx } = this.props
    return (
      <div
        ref={this.domRef}
        className={cx('MicroComponent', className, 'micro-custom')}
        style={inputStyle}>
        {this.state.loading ? <div>加载中...</div> : <div></div>}
      </div>
    )
  }
}

FormItem({
  type: 'micro-form-component',
  autoVar: true,
})(customAppRender)

Renderer({
  type: 'micro-component',
  autoVar: true,
})(customAppRender)
