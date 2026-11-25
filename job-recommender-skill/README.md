# job-recommender

一个 AI Skill：把简历发给 AI，它会推荐适合的岗位方向、发展城市和能进的公司，并附上招聘网站的投递链接，一行一条，由你自己手动投递。

不登录账号，不自动投递，不抓取招聘平台数据。

## 功能

- 读取简历（PDF、Word、图片或粘贴的文字），提取学历、专业、经历和技能
- 区分实习、校招和社招
- 推荐 2~4 个岗位方向和 2~3 个城市，每条都附依据
- 按冲刺、匹配、保底三档推荐公司，默认 10~20 条
- 每条投递附一个链接：能确认的给具体页面，确认不了的给「公司名+岗位名」搜索页，不编造链接
- 最后给 1~3 条修改简历的建议

内置的网站有 BOSS直聘、猎聘、智联招聘、前程无忧、实习僧、牛客网、应届生求职网、国家24365大学生就业服务平台、领英，以及各公司官网的招聘页。

## 输出示例

```
【投递清单】
冲刺：
A公司 机器人实习（链接）
匹配：
B公司 机械臂实习（链接）
保底：
C公司 实习（链接）
```

## 安装

详细步骤见 [INSTALL.md](INSTALL.md)。Windows 一条命令：`powershell -ExecutionPolicy Bypass -File .\install.ps1`；macOS/Linux：`sh install.sh`。

### DeepSeek Harness

把 `job-recommender` 文件夹放到下面任一位置：

- 项目内：`<项目目录>/.dsh/skills/job-recommender/`
- 全局：`~/.dsh/skills/job-recommender/`（Windows 为 `C:\Users\<用户名>\.dsh\skills\`）

### Claude Code 等支持 SKILL.md 的工具

放到 `~/.claude/skills/job-recommender/` 或项目的 `.claude/skills/` 目录。

### 其他 AI

把 `job-recommender/SKILL.md` 的内容复制给 AI 作为指令，再发简历。

## 使用

新开对话，发送简历附件，说「帮我推荐岗位，我找实习」或「找正式工作」。

## 注意

- 招聘网站大多需要登录，AI 通常打不开岗位详情页，所以多数链接是搜索页。
- 岗位是否还在招，以你点开时为准。
- 发简历前可以删掉身份证号和家庭住址，推荐用不到这些。

## 许可

MIT
