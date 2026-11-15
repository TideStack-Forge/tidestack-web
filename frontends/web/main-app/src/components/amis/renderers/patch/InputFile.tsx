import { Icon } from 'amis'
import {
  FormItem,
  isApiOutdated,
  isApiOutdatedWithData,
  isEffectiveApi,
  prettyBytes,
} from 'amis-core'
import InputFile from 'amis/lib/renderers/Form/InputFile'
import { TooltipWrapper } from 'amis-ui'
export interface FileValue {
  filename?: string
  value?: any
  name?: string
  url?: string
  state: 'init' | 'error' | 'pending' | 'uploading' | 'uploaded' | 'invalid' | 'ready'
  id?: any
  [propName: string]: any
}

@FormItem({
  type: 'input-file',
  name: 'OuroborosInputFile',
  sizeMutable: false,
  renderDescription: false,
  weight: -200,
  override: true,
  shouldComponentUpdate: (props: any, prevProps: any) =>
    !!isEffectiveApi(props.receiver, props.data) &&
    (isApiOutdated(props.receiver, prevProps.receiver, props.data, prevProps.data) ||
      isApiOutdatedWithData(
        props.receiver,
        prevProps.receiver,
        props.data,
        prevProps.data
      )),
})
// 当静态显示时，不显示上传按钮，只显示已上传的文件列表
// TODO: https://github.com/baidu/amis/pull/11609 合并后，可以考虑删除此文件
export default class OuroborosInputFile extends InputFile {
  render() {
    const {
      value,
      translate: __,
      classnames: cx,
      container,
      env,
      maxSize,
      downloadUrl,
      disabled,
    } = this.props

    const valueField = this.props.valueField || 'value'
    const joinValues = this.props.joinValues
    const delimiter = this.props.delimiter as string
    const isStatic = this.props?.static
    const nameField = this.props.nameField || 'name'
    const urlField = this.props.urlField || 'url'

    let files: any = []

    if (value && value instanceof Blob) {
      files = [value as any]
    } else if (value) {
      files = (
        Array.isArray(value)
          ? value
          : joinValues
            ? `${(value as any)[valueField] || value}`.split(delimiter)
            : [value as any]
      )
        .map((item) => OuroborosInputFile.valueToFile(item, this.props) as FileValue)
        .filter((item) => item)
    }

    if (isStatic) {
      // 静态模式下不显示上传按钮
      return (
        <>
          {Array.isArray(files) ? (
            <ul className={cx('FileControl-list')}>
              {files.map((file, index) => {
                const filename =
                  file[nameField as keyof typeof file] ||
                  (file as FileValue).filename ||
                  file.name

                return (
                  <li key={file.id}>
                    <TooltipWrapper
                      placement="top"
                      container={container || env?.getModalContainer}
                      tooltipClassName={cx(
                        'FileControl-list-tooltip',
                        (file.state === 'invalid' || file.state === 'error') &&
                          'is-invalid'
                      )}
                      tooltip={
                        file.state === 'invalid' || file.state === 'error'
                          ? (file as FileValue).error ||
                            (maxSize && file.size > maxSize
                              ? __('File.maxSize', {
                                  filename: file.name,
                                  actualSize: prettyBytes(file.size, 1024),
                                  maxSize: prettyBytes(maxSize, 1024),
                                })
                              : '')
                          : filename
                      }>
                      <div
                        className={cx('FileControl-itemInfo', {
                          'is-invalid':
                            file.state === 'invalid' || file.state === 'error',
                        })}>
                        <span className={cx('FileControl-itemInfoIcon')}>
                          <Icon icon="file" className="icon" />
                        </span>

                        {(file as FileValue)[urlField] ||
                        (file as FileValue)[valueField] ||
                        downloadUrl ? (
                          <a
                            className={cx('FileControl-itemInfoText')}
                            target="_blank"
                            rel="noopener"
                            href="#"
                            onClick={this.handleClickFile.bind(this, file)}>
                            {filename}
                          </a>
                        ) : (
                          <span className={cx('FileControl-itemInfoText')}>
                            {filename}
                          </span>
                        )}
                      </div>
                    </TooltipWrapper>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </>
      )
    } else {
      // 非静态模式下显示默认的InputFile组件
      return super.render()
    }
  }
}
