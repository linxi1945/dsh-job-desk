# DSH 求职投递插件

在 DeepSeek Harness 的「设置 → 求职投递」里保存求职偏好、管理招聘平台的专用 Edge 会话。随包附带 `job-recommender` Skill，用于读简历、推荐方向和生成一行一个入口的投递清单。平台登录、验证码、发消息和提交申请均由用户操作。

## 安装

已在 Windows 的 DSH `0.2.2-rc.1` 上运行。使用 DSH 桌面版或本机 Web 界面。打开平台和检测会话需要 Microsoft Edge。独立运行源码测试需要 Node.js 22.4 以上。其他系统的插件界面及浏览器流程尚未验收。

设置页由 DSH 自带的 `@deepseek-ai/dsh-client-runtime` 和 `@deepseek-ai/dsh-client-ui-settings` 提供运行环境。插件已在 `package.json` 声明这两项客户端前置。`cordis.patch.yml` 注册服务端，`client.js` 注册「设置 → 求职投递」和插件配置面板。安装时保留整个 `dsh-job-desk/` 目录，无需单独执行 `npm install`。仅安装独立 Skill 时不会出现设置页。

1. 解压仓库到长期保留的目录。在 DSH 插件管理中安装本地插件，安装目标填 `link:<dsh-job-desk 文件夹的绝对路径>`，例如 `link:D:\Projects\job-desk-release\dsh-job-desk`。也可以在 DSH 对话中要求调用 `plugin_manager` 的 `install_bundle`，将同一字符串作为 `target`。
2. 刷新 DSH 界面，打开「设置 → 求职投递」。新开对话后发送简历，并说明找实习、校招或社招。
3. 插件启动时会安装全局 Skill。已有同名自定义内容会保留。旧版未记录安装哈希时，也会保留已有内容。要改用最新版，可先备份已有全局 Skill，再请 DSH 重新启用插件。项目内的同名 Skill 也可能优先被发现。

## 使用

- 点平台旁的「登录」打开独立 Edge，在平台页面完成登录，然后返回设置点「检测」或「刷新全部状态」。浏览器会话保存在 DSH 数据目录下的 `job-desk/browser/`。
- 「检测到登录」来自平台页面和本地会话信号，结果随平台改版或会话过期而变化。「有凭证，待确认」表示只有本地 Cookie 信号。应届生求职网支持手动确认并保存，显示为「手动确认（未自动验证）」。LinkedIn 的可达性受访问地区和网络影响。
- 聊天里的推荐链接可以直接点击。要沿用专用 Edge 的会话，在设置里粘贴受支持平台的链接，点「在专用 Edge 打开」。公司官网使用普通浏览器打开即可。
- 支持 BOSS 直聘、实习僧、智联招聘、前程无忧、牛客、应届生求职网和 LinkedIn。
- 本机数据目录 `job-desk/` 保存设置、最新检测信号和浏览器资料。检测结果只保存判定、时间、来源和布尔值。浏览器资料含登录会话。分享问题时请提供平台名称、判定和时间，浏览器资料及账号备注应留在本机。
- 卸载时在插件管理移除该插件。全局 Skill 和本机数据由用户自行备份或清理。

## 测试

```sh
npm test
```

常规测试使用模拟平台数据。Windows 上可运行 `node test/edge-live.mjs` 用临时 Edge 配置验证匿名状态，需要网络和 Edge。
