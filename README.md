# 求职推荐 Skill + DSH 插件

本仓库包含两个可独立使用的部分：`job-recommender-skill/` 是跨智能体的简历推荐 Skill；`dsh-job-desk/` 是 DeepSeek Harness 插件，包含平台会话设置界面并内置同一 Skill。

两者只辅助求职决策和打开招聘页面，不代替用户登录、发消息或提交申请。安装、浏览器会话、数据范围和已知限制见 [插件说明](dsh-job-desk/README.md) 与 [Skill 安装教程](job-recommender-skill/INSTALL.md)。

## 快速安装

- 独立 Skill：运行 `job-recommender-skill/install.ps1`，或在 macOS/Linux 运行 `sh job-recommender-skill/install.sh`。
- DSH 插件：将 `dsh-job-desk/` 放到稳定目录，通过插件管理安装本地目标 `link:<该目录绝对路径>`。

核心使用说明见 [Skill README](job-recommender-skill/README.md)。