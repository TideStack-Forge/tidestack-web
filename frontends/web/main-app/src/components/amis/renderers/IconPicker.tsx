import { FormItem, Schema, InputBox, Icon, getIconNames } from 'amis'
import React from 'react'
import Downshift from 'downshift'
// @ts-ignore
import './IconPicker.scss'
import { debounce } from 'lodash'

const FONT_AWESOME_ICON_DATA_LOADER = {
  name: 'FontAwesome 6.x.json',
  load: () =>
    import(
      /* webpackChunkName: "icon-picker-fontawesome-6" */ './icon-data/FontAwesome 6.x.json'
    ),
}

const INTERNAL_ICON_DATA_LOADER = {
  name: 'internal.json',
  load: () =>
    import(/* webpackChunkName: "icon-picker-internal" */ './icon-data/internal.json'),
}

async function loadIconData(iconDataLoader: { name: string; load: () => Promise<any> }) {
  const iconDataModule = await iconDataLoader.load()
  return iconDataModule.default || iconDataModule
}

function withAmisInternalIcons(iconData: any, amisIconNames: any[]) {
  const nextIconData = { ...iconData }

  amisIconNames.forEach((iconName: any) => {
    if (nextIconData[iconName]) return
    nextIconData[iconName] = {
      value: iconName,
      label: iconName,
      search: {
        terms: [iconName],
      },
    }
  })

  return nextIconData
}

export default class IconPicker extends React.Component<Schema, any> {
  constructor(props: any) {
    super(props)

    this.state = {
      selectedTab: {},
      isOpen: false,
      options: [],
      inputValue: '',
      filteredOptions: {},
      searchVal: '',
    }
    this.handleChange = debounce(this.handleChange, 200).bind(this)
  }

  async componentDidMount() {
    const { showInternalIcons = false } = this.props
    const allIconDataLoaders = [FONT_AWESOME_ICON_DATA_LOADER]
    if (showInternalIcons) {
      allIconDataLoaders.push(INTERNAL_ICON_DATA_LOADER)
    }
    const amisIconNames: any[] = showInternalIcons ? getIconNames() : []
    const allIconDataList = []
    for (let i = 0; i < allIconDataLoaders.length; i++) {
      const iconDataLoader = allIconDataLoaders[i]
      try {
        const loadedIconData = await loadIconData(iconDataLoader)
        const iconData =
          iconDataLoader === INTERNAL_ICON_DATA_LOADER
            ? withAmisInternalIcons(loadedIconData, amisIconNames)
            : loadedIconData
        if (!iconData) continue
        allIconDataList.push(iconData)
      } catch (e) {
        console.warn('加载图标失败', iconDataLoader.name, e)
      }
    }
    this.setState({
      inputValue: this.props.value || '',
      options: allIconDataList,
      selectedTab: allIconDataList[0],
    })
  }

  // 切换tab
  async changeTab(option: any) {
    await this.setState({ selectedTab: option })
    if (this.state.searchVal) {
      await this.filterIcon(this.state.searchVal)
    }
  }

  // 点击 icon
  handleClick() {
    if (this.props.disabled || this.props.static) return
    this.setState({
      isOpen: true,
    })
  }

  // 外部点击
  handleBlur() {
    this.setState({
      isOpen: false,
    })
  }

  // 当所选项目发生更改时
  handleChange(selectedItem: any) {
    const { onChange, disabled } = this.props

    if (disabled) {
      return
    }
    onChange?.(selectedItem.value)
  }

  // 清空按钮点击
  handleClear(e: any) {
    const { onChange, resetValue = '' } = this.props
    onChange?.(resetValue)
    this.setState({
      inputValue: resetValue,
      isOpen: false,
    })
    e.stopPropagation()
  }

  // 搜索框发生更改时
  handleSearchInputChange(val: any) {
    this.setState({
      searchVal: val,
    })
    this.filterIcon(val)
  }

  // 搜索 过滤icon
  filterIcon(keyword: any) {
    const matchesKeyword = (icon: any) => (
      icon?.value.includes(keyword) ||
      icon?.search?.terms.some((term: any) => term.includes(keyword))
    )
    let filteredOptions: { [key: string]: any } = {} // 添加索引签名
    if (this.state.selectedTab.icons) {
      const iconData = this.state.selectedTab.icons

      const results = Object.keys(iconData).filter((key) => matchesKeyword(iconData[key]))

      filteredOptions = results.map((key) => iconData[key])
    }
    if (this.state.selectedTab.categories) {
      const categories = this.state.selectedTab.categories || []

      filteredOptions = categories.reduce((options: { [key: string]: any }, category: any) => {
        const icons = category.icons || {}

        return Object.keys(icons)
          .filter((key) => matchesKeyword(icons[key]))
          .reduce((nextOptions, key) => ({
            ...nextOptions,
            [key]: icons[key],
          }), options)
      }, filteredOptions)
    }

    this.setState({ filteredOptions })
  }

  // 渲染图标
  renderIcon(iconMap: any, getItemProps: any) {
    const { render, classnames: cx, value } = this.props
    return Object.keys(iconMap).map((icon: any) => (
      <div
        key={icon}
        {...getItemProps({
          item: iconMap[icon],
        })}
        className={cx('icon-item', {
          active: value === iconMap[icon].value,
        })}>
        {render('icon', {
          type: 'icon',
          icon: `${iconMap[icon].value}`,
          className: 'w-5 h-5',
          vendor: '',
        })}
      </div>
    ))
  }

  // 渲染图标选择
  renderIconSelector(getItemProps: any) {
    const iconData = this.state.searchVal
      ? this.state.filteredOptions
      : this.state.selectedTab

    if (iconData && Object.keys(iconData).length > 0) {
      // 判断是否有分类信息
      if (iconData.categories) {
        return iconData.categories.map((category: any) => (
          <div key={category.name}>
            <div className={'categories-title'}>{category.name}</div>
            <div>{this.renderIcon(category.icons, getItemProps)}</div>
          </div>
        ))
      } else if (iconData.icons) {
        const iconMap = iconData.icons
        return this.renderIcon(iconMap, getItemProps)
      }
      return this.renderIcon(iconData, getItemProps)
    } else {
      return <div className={'text-center mt-8'}>找不到图标</div>
    }
  }

  renderIcons() {
    const {
      render,
      placeholder,
      value,
      name,
      disabled,
      clearable = true,
      static: isStatic,
      classnames: cx,
      searchable = true, // 设置 searchable 的默认值为 true
    } = this.props
    const options = this.state.options
    return (
      // @ts-ignore
      <Downshift
        isOpen={this.state.isOpen}
        inputValue={this.state.inputValue}
        onOuterClick={this.handleBlur.bind(this)}
        onChange={(e: any) => {
          this.setState({ inputValue: e.value })
          this.handleChange(e)
        }}
        selectedItem={[value]}>
        {({ getInputProps, getItemProps, isOpen, inputValue }) => (
          <div onClick={this.handleClick.bind(this)}>
            <div className={cx('TextControl-input', 'items-baseline')}>
              {!value
                ? null
                : render('internal-icon', {
                    type: 'icon',
                    icon: `${value}`,
                    className: 'w-3 h-3 mr-2',
                    vendor: '',
                  })}

              <input
                {...getInputProps({
                  name,
                  value: this.state.inputValue,
                })}
                autoComplete="off"
                disabled={disabled || isStatic}
                placeholder={value ? '' : placeholder}
                size={10}
                onChange={(e) => {
                  this.setState({
                    inputValue: e.target.value,
                  })
                  this.handleChange({ value: e.target.value })
                }}
                onKeyUp={(e) => {
                  if (e.key === 'Backspace' && !this.state.inputValue) {
                    this.handleClear(e)
                  }
                }}
              />
              {clearable && !disabled && !isStatic && value ? (
                <a onClick={this.handleClear.bind(this)} className={cx('InputBox-clear')}>
                  <Icon icon="input-clear" className="icon" />
                </a>
              ) : null}
            </div>
            {isOpen ? (
              <div className={'icon-picker-control'}>
                <div className={'tab-header'}>
                  {options.map((option: any) => (
                    <div
                      key={option.name}
                      onClick={() => this.changeTab(option)}
                      className={
                        'defaultTab ' +
                        (this.state.selectedTab === option ? 'selectedTab' : '')
                      }>
                      {option.name}
                    </div>
                  ))}

                  {searchable ? (
                    <div>
                      <InputBox
                        placeholder={'搜索...'}
                        clearable={true}
                        value={this.state.searchVal}
                        onChange={this.handleSearchInputChange.bind(this)}></InputBox>
                    </div>
                  ) : null}
                </div>

                <div className={'icon-content'}>
                  {this.renderIconSelector(getItemProps)}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Downshift>
    )
  }

  render() {
    const { className, classnames: cx, classPrefix: ns, inputOnly, disabled } = this.props

    const input = this.renderIcons()

    if (inputOnly) {
      return input
    }

    return (
      <div
        className={cx(className, `${ns}IconPickerControl`, {
          'is-focused': this.state.isOpen,
          'is-disabled': disabled,
        })}>
        {input}
      </div>
    )
  }
}

FormItem({
  type: 'ouroboros-icon-picker',
  autoVar: true,
})(IconPicker as any)
