import { resolveEventData, isEffectiveApi, setThemeClassName, OptionsControl, themeable, localeable, VirtualList } from 'amis'
import { TreeSelector } from 'amis-ui/lib/components/Tree'
import TreeSelectControl from 'amis/lib/renderers/Form/TreeSelect'

/**
 * 修复虚拟滚动缓存问题的 Tree 组件
 */
export class FixedTreeSelector extends TreeSelector {
  
  // 用于强制虚拟列表重新渲染
  virtualListInstance: any = null;

  /**
   * 强制虚拟列表重新渲染
   */
  forceVirtualListRerender() {
    if (this.virtualListInstance && this.virtualListInstance.forceUpdate) {
      this.virtualListInstance.forceUpdate();
    }
  }

  /**
   * 重写 fireChange 方法，确保选中状态变化时虚拟列表更新
   */
  fireChange(value: any[]) {
    // 调用父类方法
    const {
      joinValues,
      extractValue,
      valueField,
      delimiter,
      onChange,
      enableNodePath
    } = this.props;

    onChange(
      enableNodePath
        ? this.transform2NodePath(value)
        : joinValues
        ? value.map(item => item[valueField as string]).join(delimiter)
        : extractValue
        ? value.map(item => item[valueField as string])
        : value
    );

    // 关键：立即强制虚拟列表重新渲染
    this.forceVirtualListRerender();
  }

  /**
   * 重写 renderList 方法，给虚拟列表添加动态 key
   */
  renderList(list: any[]) {
    const {virtualThreshold} = this.props;
    const {virtualHeight, itemHeight} = this.state;
    
    if (virtualThreshold && list.length > virtualThreshold) {
      return itemHeight ? (
        <div ref={this.virtualListRefSetter}>
          <VirtualList
            ref={(ref: any) => { this.virtualListInstance = ref; }}
            height={virtualHeight}
            itemCount={list.length}
            prefix={this.renderCheckAll()}
            itemSize={itemHeight}
            renderItem={this.renderItem}
          />
        </div>
      ) : (
        this.renderItem({index: 0, ref: this.styleGetter})
      );
    }

    // 非虚拟滚动模式，保持原有逻辑
    return (
      <>
        {this.renderCheckAll()}
        {list.map((item, index) => this.renderItem({index}))}
      </>
    );
  }

  /**
   * 重写 componentDidUpdate，监听关键 props 变化
   */
  componentDidUpdate(prevProps: any, prevState: any) {
    // 调用父类方法
    super.componentDidUpdate(prevProps, prevState);
    
    // 如果 value 发生变化，强制虚拟列表更新
    if (
      prevProps.value !== this.props.value ||
      prevState.value !== this.state.value ||
      prevState.valueSet !== this.state.valueSet
    ) {
      this.forceVirtualListRerender();
    }
  }
}

const ThemeableLocatableFixedTreeSelect = themeable(localeable(FixedTreeSelector));

/**
 * 优化版本的 TreeSelect 控件
 * 解决大数据量时选中状态更新延迟的问题
 */
export default class OptimizedTreeSelectControl extends TreeSelectControl {
  /**
   * 优化的 resultChangeEvent 方法
   */
  async resultChangeEvent(value: any) {
    const { onChange, dispatchEvent } = this.props
    const items = this.resolveOptions()
    const item = this.resolveOption(items, value)
    const rendererEvent = await dispatchEvent(
      'change',
      resolveEventData(this.props, {
        value,
        item,
        items: items,
      })
    )

    if (rendererEvent?.prevented) {
      return
    }
    onChange && onChange(value)
  }
  /**
   * 重写 renderOuter 方法，传入修复后的 Tree 组件
   */
  renderOuter() {
    const {
      value,
      enableNodePath,
      pathSeparator = '/',
      disabled,
      joinValues,
      extractValue,
      delimiter,
      placeholder,
      options,
      multiple,
      valueField,
      initiallyOpen,
      unfoldedLevel,
      withChildren,
      rootLabel,
      cascade,
      rootValue,
      showIcon,
      showRadio,
      popOverContainer,
      onlyChildren,
      onlyLeaf,
      classPrefix: ns,
      optionsPlaceholder,
      searchable,
      autoComplete,
      maxLength,
      minLength,
      labelField,
      deferField,
      nodePath,
      onAdd,
      creatable,
      createTip,
      addControls,
      onEdit,
      editable,
      editTip,
      editControls,
      removable,
      removeTip,
      onDelete,
      rootCreatable,
      rootCreateTip,
      translate: __,
      deferLoad,
      expandTreeOptions,
      selfDisabledAffectChildren,
      showOutline,
      autoCheckChildren,
      autoCancelParent,
      hideRoot,
      virtualThreshold,
      itemHeight,
      menuTpl,
      enableDefaultIcon,
      mobileUI,
      testIdBuilder,
      nodeBehavior,
      draggable,
      itemActions,
      classnames: cx,
      id,
      themeCss,
      dispatchEvent
    } = this.props;

    const filtedOptions =
      !isEffectiveApi(autoComplete) && searchable && this.state.inputValue
        ? this.filterOptions(options, this.state.inputValue)
        : options;

    return (
      <ThemeableLocatableFixedTreeSelect
        classPrefix={ns}
        onRef={this.domRef}
        onlyChildren={onlyChildren}
        onHandleNodeClick={this.handleNodeClick}
        onlyLeaf={onlyLeaf}
        labelField={labelField}
        valueField={valueField}
        deferField={deferField}
        disabled={disabled}
        onChange={mobileUI ? this.handleTempChange : this.handleChange}
        joinValues={joinValues}
        extractValue={extractValue}
        delimiter={delimiter}
        placeholder={__(optionsPlaceholder)}
        options={filtedOptions}
        highlightTxt={this.state.inputValue}
        multiple={multiple}
        initiallyOpen={initiallyOpen}
        unfoldedLevel={unfoldedLevel}
        withChildren={withChildren}
        autoCheckChildren={autoCheckChildren}
        autoCancelParent={autoCancelParent}
        rootLabel={__(rootLabel)}
        rootValue={rootValue}
        showIcon={showIcon}
        showRadio={showRadio}
        showOutline={showOutline}
        cascade={cascade}
        foldedField="collapsed"
        hideRoot={hideRoot}
        value={value || ''}
        nodePath={nodePath}
        enableNodePath={enableNodePath}
        pathSeparator={pathSeparator}
        maxLength={maxLength}
        minLength={minLength}
        onAdd={onAdd}
        creatable={creatable}
        createTip={createTip}
        rootCreatable={rootCreatable}
        rootCreateTip={rootCreateTip}
        onEdit={onEdit}
        editable={editable}
        editTip={editTip}
        removable={removable}
        removeTip={removeTip}
        onDelete={onDelete}
        bultinCUD={!addControls && !editControls}
        onDeferLoad={deferLoad}
        onExpandTree={expandTreeOptions}
        selfDisabledAffectChildren={selfDisabledAffectChildren}
        virtualThreshold={virtualThreshold}
        itemRender={menuTpl ? this.renderOptionItem : undefined}
        enableDefaultIcon={enableDefaultIcon}
        mobileUI={mobileUI}
        nodeBehavior={nodeBehavior}
        draggable={draggable}
        onMove={(dropInfo: any) =>
          dispatchEvent('move', resolveEventData(this.props, dropInfo))
        }
        itemActionsRender={itemActions ? this.renderItemActions : undefined}
        actionClassName={cx(
          setThemeClassName({
            ...this.props,
            name: 'actionControlClassName',
            id,
            themeCss
          })
        )}
        testIdBuilder={testIdBuilder}
      />
    );
  }
}

@OptionsControl({
  type: 'tree-select',
  name: 'OuroborosTreeSelect',
  override: true,
  weight: -200,
})
export class OuroborosTreeSelect extends OptimizedTreeSelectControl {
  static LARGE_DATA_THRESHOLD = 1000
  static VIRTUAL_SCROLL_THRESHOLD = 100
}
