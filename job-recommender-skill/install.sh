#!/usr/bin/env sh
# 安装 job-recommender Skill（macOS / Linux）
# 用法：
#   全局安装：          sh install.sh
#   安装到某个项目：    sh install.sh /path/to/project
#   同时装给 Claude：   CLAUDE=1 sh install.sh
set -eu
here=$(cd "$(dirname "$0")" && pwd)
src="$here/job-recommender/SKILL.md"
[ -f "$src" ] || { echo "找不到 $src" >&2; exit 1; }
base=${1:-$HOME}
if [ "$#" -gt 0 ]; then
  [ -d "$base" ] || { echo "项目目录不存在：$base" >&2; exit 1; }
  set -- "$base/.dsh/skills/job-recommender"
else
  set -- "${DSH_HOME:-$HOME/.dsh}/skills/job-recommender"
fi
if [ "${CLAUDE:-0}" = 1 ]; then
  set -- "$@" "$base/.claude/skills/job-recommender"
fi
for dir do
  if [ -f "$dir/SKILL.md" ] && ! cmp -s "$src" "$dir/SKILL.md" && [ "${FORCE:-0}" != 1 ]; then
    echo "$dir/SKILL.md 已存在且内容不同，确认覆盖请加 FORCE=1" >&2; exit 1
  fi
  mkdir -p "$dir" && cp "$src" "$dir/SKILL.md" && echo "已安装：$dir/SKILL.md"
done
echo '完成。新开一个对话即可使用。'
