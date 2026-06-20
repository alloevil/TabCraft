# TabCraft 使用说明 / User Guide

> 一份面向最终用户的完整使用说明。开发与构建请看 [README](README.md) 和 [CONTRIBUTING](CONTRIBUTING.md)。

TabCraft 是一个 Chrome 标签页管理扩展：用**本地 AI（Gemini Nano）+ 规则引擎**按主题自动分组标签页，检测重复，休眠不活跃标签页以省内存。所有处理都在本地完成，不上传任何数据。

---

## 目录

- [1. 安装](#1-安装)
- [2. 打开侧边栏](#2-打开侧边栏)
- [3. 核心功能](#3-核心功能)
- [4. 侧边栏的 8 个视图](#4-侧边栏的-8-个视图)
- [5. 快捷键与右键菜单](#5-快捷键与右键菜单)
- [6. 设置项详解](#6-设置项详解)
- [7. 启用本地 AI（Gemini Nano）](#7-启用本地-aigemini-nano)
- [8. 智能分组是怎么工作的](#8-智能分组是怎么工作的)
- [9. 常见问题 FAQ](#9-常见问题-faq)

---

## 1. 安装

### 方式 A：下载已打包版本（推荐普通用户）

1. 前往 [Releases](https://github.com/alloevil/TabCraft/releases) 下载最新的 `chrome-mv3-prod.zip`
2. 解压到一个固定文件夹（不要删，扩展会一直从这里加载）
3. 打开 `chrome://extensions/`
4. 右上角打开 **开发者模式（Developer mode）**
5. 点 **加载已解压的扩展程序（Load unpacked）**，选中解压出的文件夹
6. TabCraft 图标出现在工具栏即安装成功

### 方式 B：从源码构建（开发者）

```bash
git clone https://github.com/alloevil/TabCraft.git
cd TabCraft
npm install
npm run build          # 产物在 build/chrome-mv3-prod/
```

然后在 `chrome://extensions/` → 开发者模式 → 加载已解压的扩展程序，选 `build/chrome-mv3-prod/`。

> **Chrome 版本要求**：基础功能需 Chrome 120+；本地 AI（Gemini Nano）需 Chrome 127+，详见[第 7 节](#7-启用本地-aigemini-nano)。未满足时会**自动回退到规则引擎**，功能不受影响。

---

## 2. 打开侧边栏

TabCraft 的主界面是 Chrome 的**侧边栏（Side Panel）**：

- 点击工具栏的 TabCraft 图标，或
- 点击地址栏右侧的侧边栏图标，选择 TabCraft

侧边栏会停靠在浏览器右侧，列出当前窗口的所有标签页，顶部是导航栏。

---

## 3. 核心功能

| 功能 | 作用 | 在哪触发 |
|------|------|----------|
| **智能分组 Smart Group** | 一键把当前窗口所有标签页按主题分到原生标签组里 | 顶部按钮 / 快捷键 `Ctrl+Shift+G` / 右键菜单 |
| **撤销分组 Undo** ↩️ | 一键还原到上一次分组前的布局（分组动作会自动存快照） | 智能分组后出现的 ↩️ 按钮 |
| **去重 Dedup** | 关闭重复标签页（忽略 `utm_*` 等跟踪参数后比对 URL） | 顶部按钮 / 快捷键 `Ctrl+Shift+D` / Dedup 视图 |
| **休眠 Hibernate** 💤 | 挂起长时间不活跃的标签页释放内存，再次点击时恢复 | 顶部按钮 / 右键菜单 |
| **工作区 Workspaces** 💼 | 把当前所有标签页/分组存成一个命名快照，之后一键恢复 | Workspaces 视图 |
| **规则 Rules** 📋 | 查看/编辑 390+ 条内置域名规则，支持导入导出 | Rules 视图 |
| **统计 Stats** 📊 | 累计分组数、休眠数、关闭的重复数、预估省下的内存 | Stats 视图 |

---

## 4. 侧边栏的 8 个视图

导航栏从左到右：

| 图标 | 视图 | 内容 |
|------|------|------|
| 📑 | **Tabs** | 当前窗口标签页平铺列表，可搜索、点击切换、关闭 |
| 🌳 | **Tree** | 按"分组 → 标签页"的树状层级查看，便于折叠管理 |
| 🔗 | **Dedup** | 列出重复的 URL（带差异高亮），逐组选择关闭 |
| 📋 | **Rules** | 域名 → 分类规则的增删改，导入/导出 JSON |
| ⚙️ | **Settings** | 所有偏好设置（见第 6 节） |
| 💼 | **Workspaces** | 保存/恢复/导出标签页快照 |
| 📊 | **Stats** | 使用统计仪表盘 |
| ⚡ | **Quick** | 批量操作面板：全部折叠 / 恢复 / 休眠 / 去重 / 关闭右侧 / 关闭 7 天前的旧标签页（这些破坏性操作都有二次确认弹窗）|

---

## 5. 快捷键与右键菜单

### 默认快捷键

| 操作 | Windows/Linux | macOS |
|------|---------------|-------|
| 智能分组所有标签页 | `Ctrl+Shift+G` | `Command+Shift+G` |
| 关闭重复标签页 | `Ctrl+Shift+D` | `Command+Shift+D` |

> 快捷键可在 `chrome://extensions/shortcuts` 自定义。如与其他扩展冲突，在此修改即可。

### 右键菜单（在任意网页上点右键）

- **TabCraft: Smart Group All Tabs** — 智能分组
- **TabCraft: Close Duplicates** — 关闭重复
- **TabCraft: Hibernate Inactive Tabs** — 休眠不活跃标签页

---

## 6. 设置项详解

在 **Settings** 视图（⚙️）中可配置以下选项，括号内为默认值：

| 设置 | 默认 | 说明 |
|------|------|------|
| **Auto Group**（自动分组） | 开 | 新标签页打开时，若同类已有 ≥ `minTabsPerGroup` 个，自动归组 |
| **Min Tabs Per Group**（每组最少标签数） | 2 | 少于此数不会单独成组（可选 2/3/4/5） |
| **Grouping Mode**（分组模式） | smart | `smart` = 按主题（AI+规则）；`domain` = 仅按域名 |
| **Auto Close Duplicates**（自动去重） | 关 | 检测到重复时自动关闭，而非仅提示 |
| **Show Duplicate Badge**（重复角标） | 开 | 在图标上显示当前重复标签页数量 |
| **Hibernation Timeout**（休眠超时） | 30 分钟 | 超过此时长未访问的标签页会被休眠（可选 15/30/60/120） |
| **AI Provider**（AI 引擎） | gemini-nano | `gemini-nano` = 本地 AI；`rule-engine` = 纯规则（更快、无需下载模型） |
| **Theme**（主题） | system | 跟随系统 / 浅色 / 深色 |
| **Learn From Activity**（从行为学习） | 关 | 开启后，你手动把标签页拖进某个命名分组时，TabCraft 会记住"该域名 → 该分组"，以后自动套用 |

---

## 7. 启用本地 AI（Gemini Nano）

TabCraft 的 AI 完全在你的设备上运行（Chrome 内置的 Gemini Nano），不联网、不上传。

**要求**：Chrome 127+（部分版本需要打开实验标志）。

启用步骤：

1. 确认 Chrome 版本 ≥ 127（`chrome://version`）
2. 打开 `chrome://flags`，搜索并启用：
   - **Prompt API for Gemini Nano** → Enabled
   - **Enables optimization guide on device** → Enabled (BypassPerfRequirement)
3. 重启 Chrome
4. 打开 `chrome://components`，找到 **Optimization Guide On Device Model**，点 **检查更新**，等待模型下载完成（约 1–2 GB，仅一次）
5. 回到 TabCraft，Settings 里 AI Provider 选 `gemini-nano`

**如果 AI 不可用会怎样？** TabCraft 会自动回退到内置规则引擎（390+ 条域名规则 + 关键词匹配），分组照常工作，只是对"标题语义"的理解不如 AI 细。你随时可以在设置里切回 `rule-engine` 强制使用规则模式。

---

## 8. 智能分组是怎么工作的

理解分组逻辑有助于你预期结果：

1. **逐个标签页判定归属**（按当前 Grouping Mode）：
   - `smart` 模式：先查**自学映射**（若开启）→ 再查**域名规则**（390+ 条）→ 命中则用规则分类；未命中且 AI 可用时，调 AI 读标题语义分类；都没有则归入 **Other**。
   - `domain` 模式：直接按域名分组（如 `github.com` → "GitHub"）。
2. **批量 AI 调用**：需要 AI 判定的标签页会**合并成一次调用**分类，比逐个调用快得多；若解析失败则自动降级为逐个调用。
3. **复用同名分组**：已存在的同名标签组会被复用，而不是每次新建，避免出现重复的 "Development" 组。
4. **稳定配色**：同一类别永远是同一种颜色（如 Development=蓝、AI & ML=紫、Other=灰），帮助你建立肌肉记忆；未知类别用名字哈希取一个固定颜色。
5. **可撤销**：每次智能分组前都会存一份布局快照，点 ↩️ 即可还原（最多保留 10 步历史）。

---

## 9. 常见问题 FAQ

**Q：分组后想还原怎么办？**
A：点智能分组按钮旁出现的 ↩️（Undo）。它会把标签页恢复到分组前所属的组。

**Q：为什么有些标签页没被分组？**
A：固定（pinned）标签页、`chrome://` 内部页面会被跳过；某类标签页数量少于 `Min Tabs Per Group` 时也不会单独成组。

**Q：休眠的标签页数据会丢吗？**
A：不会。休眠只是释放内存，再次点击该标签页会重新加载页面。

**Q：去重会误关我正在用的标签页吗？**
A：去重按规范化 URL（去掉跟踪参数）比对，每组重复中保留一个。建议先在 **Dedup 视图**预览再关闭；`Auto Close Duplicates` 默认是关闭的。

**Q：数据存在哪？会同步吗？**
A：规则、设置、统计都存在 `chrome.storage.local`，仅本机，不随账号同步、不上传服务器。可在 Rules 视图导出备份。

**Q：AI 模型要下载，占空间吗？**
A：Gemini Nano 模型约 1–2 GB，由 Chrome 统一管理（多个扩展共享）。不想下载就用 `rule-engine` 模式。

---

如发现说明与实际行为不符，欢迎在 [Issues](https://github.com/alloevil/TabCraft/issues) 反馈。
