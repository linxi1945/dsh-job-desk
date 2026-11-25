# 安装教程

Skill 只有一个文件：`job-recommender/SKILL.md`。安装就是把它放到智能体会读取的技能目录里。

## 第一步：下载

任选一种：

- 网页下载：在仓库页面点绿色的「Code」按钮，选「Download ZIP」，下载后解压。
- 使用 Git 克隆发布仓库后，进入 `job-recommender-skill` 目录运行下面的命令。

## 第二步：安装

### Windows（推荐用脚本）

在解压后的文件夹空白处按住 Shift 点右键，选「在终端中打开」或「在此处打开 PowerShell 窗口」，然后运行：

```powershell
# 全局安装，所有项目都能用
powershell -ExecutionPolicy Bypass -File .\install.ps1

# 只装到某个项目
powershell -ExecutionPolicy Bypass -File .\install.ps1 -Project D:\我的项目

# 同时装给 Claude Code
powershell -ExecutionPolicy Bypass -File .\install.ps1 -Claude
```

### macOS / Linux

```sh
sh install.sh                     # 全局安装
sh install.sh /path/to/project    # 装到某个项目
CLAUDE=1 sh install.sh            # 同时装给 Claude Code
```

### 手动安装（不想运行脚本）

把整个 `job-recommender` 文件夹复制到下表中的目录。最终路径应为 `.../skills/job-recommender/SKILL.md`。

| 智能体 | 全局目录 | 项目目录 |
|---|---|---|
| DeepSeek Harness | `C:\Users\<用户名>\.dsh\skills\`（macOS/Linux：`~/.dsh/skills/`） | `<项目>\.dsh\skills\` |
| Claude Code | `~/.claude/skills/` | `<项目>/.claude/skills/` |
| 其他 AI | 无需安装：把 `SKILL.md` 全文粘贴给 AI 当作指令 | |

## 第三步：确认装好了

新开一个对话（已经打开的对话不会自动刷新技能列表），问 AI：「你有 job-recommender 技能吗？」它能说出技能描述就是装好了。

然后发简历附件，说「帮我推荐岗位，我找实习」或「找正式工作」。

## 更新与卸载

- 更新：下载新版本后重新运行安装脚本。如果你改过本地的 `SKILL.md`，脚本会拒绝覆盖，确认要覆盖时 Windows 加 `-Force`，macOS/Linux 加 `FORCE=1`。
- 卸载：删除对应目录下的 `job-recommender` 文件夹。

## 常见问题

- **提示“无法加载脚本，因为在此系统上禁止运行脚本”**：用上面带 `-ExecutionPolicy Bypass` 的命令运行，或改用手动安装。
- **新对话里看不到技能**：检查路径是不是多套了一层，例如 `skills/job-recommender/job-recommender/SKILL.md` 是错的。
- **项目目录装了却没生效**：DeepSeek Harness 把最近的含 `.git` 的上级目录当作项目根目录。如果你的项目在某个 Git 仓库里面，要装到那个仓库根目录下的 `.dsh/skills/`，或者直接全局安装。
