# Ouroboros 前端 Web

本目录位于主仓库 `frontends/web`，用于维护 Ouroboros 前端基座及相关微前端模块。

## 文档入口

- [AGENTS.md](./AGENTS.md): AI 入口，说明前端子树应先读取哪些文档。
- [TESTING.md](./TESTING.md): 前端测试统一规范，仅覆盖 `frontends/web/**`。

## 项目结构

- main-app 主应用
- [ouroboros-amis-runtime](ouroboros-amis-runtime/README.md) Web/IDE 共用的 Amis 行为、样式与显式宿主能力合同
- ouroboros-debug-console-topbar 开发平台顶部调试工具栏，使用微前端的方式注册到开发平台的前端中
- ouroboros-logicflow-editor 逻辑流设计器，使用微前端的方式注册到主应用中
- ouroboros-sdk 微前端SDK
- ouroboros-approval-workflow-designer 审批流 React Flow 编辑器与只读 viewer

## 前端基座镜像（`ouroboros-web`）

`ouroboros-web` 现在不再只是“前端 dist 资源层”，而是一个可独立启动的前端基座镜像。它内置：

- `main-app` 的静态构建产物（`/app/base/web`）
- Nginx 运行时
- 同源代理能力（把 `/api`、`/file`、`/actuator`、`/websocket` 转发到后端）
- 微前端静态资源回退目录（`/app/deploy/web`）

它适合两种场景：

1. **独立前端联调**：后端开发者或前端开发者单独启动一个 web 容器，把它代理到本地后端。
2. **split 拓扑部署**：`ouroboros-web` 作为前端入口，后端运行端单独部署，二者通过 HTTP 代理和共享卷组合成完整应用。

如果你要的是“前后端都在一个容器里”的传统部署方式，继续使用 `ouroboros-mothership`。`mothership` 没有被替换，它仍然是 all-in-one 运行基座。

### 容器内目录约定

```text
/app
├── base/
│   └── web/                # 镜像内置的 main-app 静态资源
└── deploy/
    ├── web/                # 外部挂载的微前端静态资源目录
    ├── logs/web/           # Nginx access/error 日志
    └── nginx/conf.d/       # 运行时可追加的 Nginx 配置片段
```

静态资源读取顺序：

1. 先读 `/app/base/web`
2. 找不到时回退到 `/app/deploy/web`

这个回退语义是为了兼容后端自动部署出来的微前端包。split 拓扑下，通常由后端运行端写入 `/app/deploy/web`，`ouroboros-web` 只负责读取和服务它。

### 运行时环境变量

| 变量名 | 默认值 | 说明 |
|---|---|---|
| `BACKEND_URL` | `http://127.0.0.1:8080` | `/api`、`/file`、`/actuator`、`/websocket` 的代理目标，必须以 `http://` 或 `https://` 开头 |
| `LISTEN_PORT` | `80` | Nginx 监听端口 |
| `WEB_ROOT` | `/app/base/web` | 内置静态资源根目录 |
| `DEPLOY_WEB_ROOT` | `/app/deploy/web` | 外部微前端静态资源回退目录 |
| `MICRO_PROXY_MAP` | 空 | 为指定微前端路径生成额外反向代理规则，格式为 `路径=目标URL,路径=目标URL` |

默认发布脚本为 amd64 主标签和 `-arm64` 标签分别构建；ARM 环境按实际镜像发布结果选择 `latest-arm64` 或对应版本的 `-arm64` 标签。只有显式启用多架构发布才生成主标签 manifest。

### 基本启动方式

#### 1. 只验证静态资源是否可启动

```bash
docker run --rm -p 18080:80 \
  registry.cn-hangzhou.aliyuncs.com/ouroboros/ouroboros-web:latest
```

这时首页和静态资源可访问，但 `/api/*` 等请求会走默认 `http://127.0.0.1:8080`；如果容器里没有后端，对应接口会失败。

#### 2. 指向本机后端做联合调试

```bash
docker run --rm -p 18080:80 \
  --add-host=host.docker.internal:host-gateway \
  -e BACKEND_URL=http://host.docker.internal:18888 \
  registry.cn-hangzhou.aliyuncs.com/ouroboros/ouroboros-web:latest
```

适合：

- 后端本机直接启动 Spring Boot
- 只想复用标准前端基座和代理逻辑，不想本地再起一套前端 dev server

#### 3. split 拓扑：web + 后端容器

```yaml
services:
  web:
    image: registry.cn-hangzhou.aliyuncs.com/ouroboros/ouroboros-web:latest
    ports:
      - "80:80"
    environment:
      BACKEND_URL: http://backend:8080
    volumes:
      - micro-web:/app/deploy/web:ro

  backend:
    image: registry.cn-hangzhou.aliyuncs.com/ouroboros/ouroboros-mothership:latest
    environment:
      ENABLE_NGINX: "false"
    volumes:
      - micro-web:/app/deploy/web

volumes:
  micro-web:
```

这个拓扑里：

- 浏览器永远访问 `web`
- `web` 负责静态资源和代理
- 后端运行端继续负责把微前端包部署到 `/app/deploy/web`

### 微前端路径反代（`MICRO_PROXY_MAP`）

当某些微前端不是从共享卷读静态文件，而是要直接代理到正在运行的本地服务时，可以用 `MICRO_PROXY_MAP`：

```bash
docker run --rm -p 18080:80 \
  --add-host=host.docker.internal:host-gateway \
  -e BACKEND_URL=http://host.docker.internal:88 \
  -e 'MICRO_PROXY_MAP=/debug-console-header/=http://host.docker.internal:88,/micro-logicflow-editor/=http://host.docker.internal:88' \
  registry.cn-hangzhou.aliyuncs.com/ouroboros/ouroboros-web:latest
```

规则说明：

- 多条规则用逗号分隔
- 每条规则格式是 `路径=目标URL`
- 路径建议写成以 `/` 开头、以 `/` 结尾
- 目标必须是 `http://` 或 `https://` 开头

适用场景：

- 本地 debug 某个微前端包
- 某个微前端仍在独立 dev server 上运行
- 想让前端基座保持统一入口，但某些微前端走独立运行时

### 自定义 Nginx 配置片段

如果默认代理规则还不够，可以通过挂载 `/app/deploy/nginx/conf.d/` 追加 Nginx 片段：

```bash
docker run --rm -p 18080:80 \
  -e BACKEND_URL=http://host.docker.internal:18888 \
  -v $(pwd)/nginx-conf:/app/deploy/nginx/conf.d:ro \
  registry.cn-hangzhou.aliyuncs.com/ouroboros/ouroboros-web:latest
```

这个目录会在 Nginx 的 `http` 上下文自动 `include`。可增加 `map`、`upstream` 或完整 `server` 配置；`location` 必须放在自己定义的 `server` 中，不能在该目录裸写 location。适合补：

- 新 server 内的特殊 location 规则
- 某些环境专属的 header / cache / redirect 策略
- 默认模板未覆盖的高级反代需求

### 与 `ouroboros-mothership` 的关系

可以把两者理解成并行的两种运行形态：

| 形态 | 适合场景 | 特点 |
|---|---|---|
| `ouroboros-web` | 前后端分离部署、联合调试、split 拓扑 | 前端基座独立，可代理到任意后端 |
| `ouroboros-mothership` | all-in-one 部署、兼容现有运行方式 | 前端静态资源、Nginx、后端都在一个镜像中 |

当前不提供纯后端基座镜像；如果需要 split 拓扑的后端端点，可以先复用关闭 Nginx 的 `mothership`，或直接使用本地启动的后端进程。

## 开发指南

### 代码风格

- eslint 配置参考主应用的配置，子模块的配置需要与主应用保持一致。
- prettier 配置参考主应用的配置，子模块的配置需要与主应用保持一致。

需要配置相关的IDE插件，以保证代码风格的一致性。

编辑器插件可按团队选择；格式与检查以包内 eslint/prettier 配置及测试规范为准。

### 发版流程（与当前 Jenkins 规则一致）

#### 1. 快照版本

##### 步骤

- 推送分支：`frontend-web/snapshot/v<版本号>`
- 触发 CI/CD 构建，发布前端基座镜像：`ouroboros-web:<版本号>-snapshot`

##### 示例

- 创建并推送分支

```bash
git checkout -b frontend-web/snapshot/v1.2.3
git push origin frontend-web/snapshot/v1.2.3
```

- 自动构建，发布前端基座镜像：`ouroboros-web:1.2.3-snapshot`

#### 2. 发布准备版本（prerelease）

##### 步骤

- 推送分支：`frontend-web/release/v<版本号>`
- 触发 CI/CD 构建，发布前端基座镜像：`ouroboros-web:<版本号>-prerelease`

##### 示例

- 创建并推送分支

```bash
git checkout -b frontend-web/release/v1.2.3
git push origin frontend-web/release/v1.2.3
```

- 自动构建，发布前端基座镜像：`ouroboros-web:1.2.3-prerelease`

#### 3. 发布前端基座版本

##### 步骤

- 推送 **tag**：`frontend-web-v<版本号>`
- 触发 CI/CD 构建：

  - 发布前端基座镜像：`ouroboros-web:<版本号>`
  - 如果 tag 的 annotation 包含 `[publish sdk]`，则会同时发布 `ouroboros-sdk:<版本号>` 到 npm 官方仓库。

##### 示例

- 创建并推送 tag

```bash
git tag -a frontend-web-v1.2.3 -m "release web v1.2.3 [publish sdk]"
git push origin frontend-web-v1.2.3
```

- 自动构建：

  - 发布前端基座镜像：`ouroboros-web:1.2.3`
  - 发布 `ouroboros-sdk:1.2.3` 到 npm 官方仓库。

#### 4. 单独发布 SDK 版本

##### 步骤

- 推送 **tag**：`frontend-web-sdk-v<版本号>` 或 `frontend-web-sdk/v<版本号>`
- 触发 CI/CD 构建，自动构建发布 `ouroboros-sdk:<版本号>` 到 npm 官方仓库

##### 示例

- 创建并推送 tag

```bash
git tag -a frontend-web-sdk-v1.2.4-beta.1 -m "release sdk v1.2.4-beta.1"
git push origin frontend-web-sdk-v1.2.4-beta.1
```

- 自动构建，发布 `ouroboros-sdk:1.2.4-beta.1` 到 npm 官方仓库。

### 版本号规范

版本号规范遵循 [语义化版本 2.0.0](https://semver.org/lang/zh-CN/)。

正式发布的版本没有字母后缀，只有数字组成，而且版本号必须是递增的。

参照语义化版本规范，测试版本根据情况使用 alpha、beta、rc 等后缀，也可以视情况继续添加数字，例如 1.0.0-alpha.1、1.0.0-beta.2、1.0.0-rc.3。
