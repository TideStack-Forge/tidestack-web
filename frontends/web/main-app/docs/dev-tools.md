# 开发工具

## 功能说明

开发工具提供了一个便捷的配置界面，用于动态配置：
1. **API Host** - 后端 API 服务器地址
2. **微前端入口** - 各个微应用的入口地址

方便在开发时进行前后端联调，无需修改代码或重启服务。

## 控制台命令

| 命令 | 说明 |
|------|------|
| `__DEV_TOOL.config()` | 打开配置对话框 |
| `__DEV_TOOL.getConfig()` | 查看当前配置 |
| `__DEV_TOOL.clearConfig()` | 清除所有配置并刷新 |
| `__DEV_TOOL.help()` | 显示帮助信息 |

## 使用方式

### 1. 打开配置对话框

在浏览器控制台输入：

```javascript
__DEV_TOOL.config()
```

### 2. 配置 API Host

在"API Host"输入框中输入后端服务器地址（需为合法 URL）：
- 例如：`http://192.168.1.100:8888`
- 留空则使用默认配置

### 3. 拉取微前端配置

点击"拉取配置"按钮：
- 从指定的 API Host 拉取 `/api/sys/web-app-info` 接口
- 自动解析出所有微前端入口，按分类展示

### 4. 配置微前端入口

拉取配置后显示入口表格，按分类组织：

| 分类 | 说明 |
|------|------|
| 布局组件 | 头部导航、侧边栏导航、登录页面 |
| 平台组件库 | AMIS 组件库等 |
| 业务微应用 | 从路由表中提取的微应用 |

- **原始入口**：后端配置中的默认入口
- **自定义入口**：填写后覆盖原始入口，留空则使用原始入口
- 支持手动新增条目（分类默认为"自定义"）

### 5. 保存配置

点击"保存并刷新"：配置保存到 `sessionStorage`，页面自动刷新生效。

## 配置存储

所有配置存储在 `sessionStorage` 中：

| Key | 说明 |
|-----|------|
| `apiHost` | API 服务器地址 |
| `devMicroEntries` | 微前端配置列表 |
| `devMicroEntryMap` | 微前端入口映射（仅自定义的） |

- 每个浏览器标签页独立配置
- 关闭标签页后自动清除

## 跨域（CORS）配置

当 API Host 指向不同域名时，目标服务器的 nginx 需要配置 CORS：

```nginx
location /api/ {
    add_header Access-Control-Allow-Origin $http_origin always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Authorization, token" always;
    add_header Access-Control-Allow-Credentials true always;
    if ($request_method = OPTIONS) {
        return 204;
    }
    proxy_pass http://backend;
}
```

`/file/` 和 `/websocket/` 的 location 也需要类似配置。

## 使用场景

### 场景 1：连接不同的后端环境

```javascript
__DEV_TOOL.config()
// 输入 API Host: http://test-api.example.com
// 点击"拉取配置" → "保存并刷新"
```

### 场景 2：本地联调微前端

1. 启动微前端本地开发服务器（如 `http://localhost:8083`）
2. `__DEV_TOOL.config()` → 拉取配置
3. 在对应微应用的"自定义入口"列填入本地地址
4. 保存并刷新

### 场景 3：手动添加微前端入口

对于未被自动解析的微前端，可通过表格的"新增"按钮手动添加。
