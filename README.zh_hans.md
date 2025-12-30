# Cloudflared Tunnel GUI（中文）

这是一个用于管理 Cloudflare Tunnel（`cloudflared`）的桌面端 GUI（Electron + React + Vite），支持启动/停止隧道进程，并编辑本机的 `~/.cloudflared/config.yml`（主要是 `ingress` 规则）。

## 主要功能

- 启动/停止 `cloudflared tunnel run`，并查看运行日志
- 读取/编辑本机 `~/.cloudflared/config.yml`（YAML）
- 通过表单管理 ingress 规则（写入到 `ingress`）
- Cloudflare 授权：调用 `cloudflared tunnel login` 并展示认证状态
- 支持中英文切换与主题切换

## 环境依赖

- Node.js（建议使用较新的 LTS）
- pnpm
- 已安装 `cloudflared`，并且可以在终端通过 `cloudflared` 命令直接运行
  - macOS（Homebrew）：`brew install cloudflare/cloudflare/cloudflared`

## 开发运行

```bash
pnpm install
pnpm electron:dev
```

## 构建打包

```bash
pnpm install
pnpm electron:build
```

打包产物默认输出到 `release/`（由 `electron-builder` 配置）。

## 配置文件说明

- 配置路径：`~/.cloudflared/config.yml`
- 应用启动时会读取该文件。
- 在 UI 中新增/编辑/删除规则后，会更新 `ingress` 并保存文件。
- 若目录 `~/.cloudflared/` 不存在会自动创建；保存前会对旧配置做一次备份。

## 常见问题

- **提示找不到 cloudflared**：请先安装并确保 `PATH` 可用，安装后重启应用。
- **隧道启动失败**：查看 Dashboard 的日志区域；检查 `config.yml` 是否是合法 YAML，`ingress` 规则是否正确。
