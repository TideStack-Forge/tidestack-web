# 登录页国际化 (i18n) 指南

本文档已停止维护。

原先分散在该文件中的自定义登录页 i18n 接入说明，现已合并到平台 handbook 的统一文档：

- [平台自定义登录页集成指南](../../../../docs/handbook/docs/fusion-development/custom-login-page-and-auth-integration.md)

新文档统一覆盖以下内容：

- 自定义登录页微前端的接入边界
- 本地登录、LDAP 登录、CAS/OAuth2/OIDC 跳转登录的组织方式
- `props.token` 与 `getToken()` 的使用差异
- `/login` 与 `common` namespace 的 i18n 接入方式
- 推荐语言 key、语言切换、打包与平台配置方式

如果你正在接入或维护自定义登录页，请以新的 handbook 文档为准，不要继续扩展本文件。
