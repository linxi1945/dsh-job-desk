# 安装 job-recommender Skill（Windows PowerShell 5.1+ / PowerShell 7）
# 用法：
#   全局安装（所有项目可用）：  .\install.ps1
#   安装到某个项目：            .\install.ps1 -Project D:\我的项目
#   同时装给 Claude Code：      .\install.ps1 -Claude
param(
    [string]$Project,
    [switch]$Claude,
    [switch]$Force
)
$ErrorActionPreference = 'Stop'
$src = Join-Path $PSScriptRoot 'job-recommender\SKILL.md'
if (-not (Test-Path -LiteralPath $src)) { throw "找不到 $src，请在仓库根目录运行本脚本" }

$targets = @()
if ($Project) {
    $p = (Resolve-Path -LiteralPath $Project).Path
    $targets += Join-Path $p '.dsh\skills\job-recommender'
    if ($Claude) { $targets += Join-Path $p '.claude\skills\job-recommender' }
} else {
    $dshRoot = if ([string]::IsNullOrWhiteSpace($env:DSH_HOME)) { Join-Path $HOME '.dsh' } else { $env:DSH_HOME.Trim() }
    $targets += Join-Path $dshRoot 'skills\job-recommender'
    if ($Claude) { $targets += Join-Path $HOME '.claude\skills\job-recommender' }
}

foreach ($dir in $targets) {
    $dst = Join-Path $dir 'SKILL.md'
    if ((Test-Path -LiteralPath $dst) -and -not $Force) {
        if ((Get-FileHash $dst).Hash -eq (Get-FileHash $src).Hash) { Write-Host "已是最新：$dst"; continue }
        throw "$dst 已存在且内容不同。确认要覆盖请加 -Force"
    }
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    Copy-Item -LiteralPath $src -Destination $dst -Force
    Write-Host "已安装：$dst"
}
Write-Host '完成。新开一个对话即可使用：发送简历并说“帮我推荐岗位”。'
