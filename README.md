# antigravity-session-title

Antigravity 新会话规范命名插件（与 [`codex-session-title`](https://github.com/Oct1AtJoe/codex-session-title) / [`claude-session-title`](https://github.com/Oct1AtJoe/claude-session-title) / [`zcode-session-title`](https://github.com/Oct1AtJoe/zcode-session-title) 同系列）。

新建会话首轮回复前，自动把当前会话标题规范设置为 `MMDD｜类型｜主题`；同时支持通过 `/session-naming` 对当前或历史会话进行手动或批量规范重命名。

## 原理

两条链路组合生效，全程离线、零第三方依赖、不发额外模型请求：

1. **`SessionStart` Hook（`hooks.json` + `scripts/session-start.mjs`）**
   新会话启动时，按 `Asia/Shanghai`（UTC+8）计算当天 `MMDD`，通过 Antigravity 原生 `injectSteps` 向对话注入命名规范与脚本调用命令。
2. **改名脚本（`scripts/set-title.mjs`）+ 命名 Skill（`skills/session-naming/SKILL.md`）**
   - `set-title.mjs` 基于 Node.js 内置 `fetch` 调用 Antigravity 本地 `ConversationService`（`GetConversation` / `UpdateConversation`），写入 `annotations.title`。
   - 内置格式校验（全角分隔符 `｜`、有效 `MMDD`、8 个允许类型、主题长度与禁用词检查）与幂等保护（若标题已符合规范默认跳过）。
   - `skills/session-naming/SKILL.md` 提供完整类型表、判定顺序、示例以及历史会话批量重命名流程。

## 命名格式

```text
MMDD｜类型｜主题
```

- **分隔符**：全角竖线 `｜`（`U+FF5C`）
- **`MMDD`**：会话创建日期，`Asia/Shanghai`（UTC+8）两位月 + 两位日
- **`类型`**：仅限以下 8 个之一
  `功能` / `设计` / `修复` / `优化` / `发布` / `探索` / `文档` / `研究`
- **`主题`**：2–8 个字（兼容少量英文专有名词），概括核心诉求，**不得包含类型词**，不含标点与引号

### 类型判定优先级

1. 有明显故障或报错 → **修复**
2. 有明确新增能力 → **功能**
3. 只谈外观/交互/方案 → **设计**
4. 只谈变快变好但无故障 → **优化**
5. 只谈提交/上线 → **发布**
6. 只谈文档产出 → **文档**
7. 深度验证或选型对比 → **研究**
8. 其余了解性诉求（含纯寒暄/测试如 `hello`） → **探索**

## 目录结构

```text
antigravity-session-title/
├── plugin.json                      # Antigravity 原生插件清单
├── hooks.json                       # 根目录 SessionStart Hook 配置
├── README.md
├── LICENSE
├── assets/
│   └── logo.svg                     # Customizations 页面图标
├── scripts/
│   ├── session-start.mjs            # SessionStart 注入脚本
│   └── set-title.mjs                # 标题校验与 ConversationService 更新脚本
└── skills/
    └── session-naming/
        └── SKILL.md                 # 规范细则与 /session-naming Skill
```

## 安装

### 前置条件

- Antigravity（支持全局插件目录 `~/.gemini/config/plugins/` 与 `hooks.json`）
- Node.js >= 18（推荐 22+ / 24+，脚本使用原生 ESM 与 `fetch`）

### 一键克隆到全局插件目录

**Windows (PowerShell)：**

```powershell
git clone https://github.com/Oct1AtJoe/antigravity-session-title.git "$env:USERPROFILE\.gemini\config\plugins\session-title"
```

**macOS / Linux：**

```bash
git clone https://github.com/Oct1AtJoe/antigravity-session-title.git ~/.gemini/config/plugins/session-title
```

Antigravity 会自动发现 `~/.gemini/config/plugins/session-title/` 下的 `plugin.json`、`hooks.json` 与 `skills/`，无需注册额外的 marketplace，也无需手动复制缓存。安装后可在 Customizations 页面看到 **Session Title** 插件处于启用状态。

## 验证与手动操作

### 1. 验证 `SessionStart` Hook 输出

**Windows (PowerShell)：**

```powershell
'{"conversationId":"test-conv","hookEventName":"SessionStart"}' | node "$env:USERPROFILE\.gemini\config\plugins\session-title\scripts\session-start.mjs"
```

**macOS / Linux：**

```bash
echo '{"conversationId":"test-conv","hookEventName":"SessionStart"}' | node ~/.gemini/config/plugins/session-title/scripts/session-start.mjs
```

预期输出包含 `injectSteps[0].systemMessage.systemMessage`，内含当日 `MMDD` 与 `set-title.mjs` 绝对路径。

### 2. 手动设置或校验标题

在 Antigravity 会话终端中运行（自动读取 `ANTIGRAVITY_LS_ADDRESS`、`ANTIGRAVITY_CSRF_TOKEN`、`ANTIGRAVITY_CONVERSATION_ID`）：

```powershell
# 设置当前会话标题（已符合格式时默认跳过）
node "$env:USERPROFILE\.gemini\config\plugins\session-title\scripts\set-title.mjs" "1125｜功能｜会话命名插件"

# 强制覆盖已符合格式的标题
node "$env:USERPROFILE\.gemini\config\plugins\session-title\scripts\set-title.mjs" "1125｜功能｜会话命名插件" --force

# 仅校验格式并检查当前标题，不写入
node "$env:USERPROFILE\.gemini\config\plugins\session-title\scripts\set-title.mjs" "1125｜功能｜会话命名插件" --dry-run

# 指定其他会话 ID
node "$env:USERPROFILE\.gemini\config\plugins\session-title\scripts\set-title.mjs" "1125｜探索｜构建流程梳理" --conversation-id "<conversation-id>"
```

### 3. 批量规范历史会话

直接在任意对话中发送：

```text
/session-naming 帮我把现有的历史对话都改成规范标题格式
```

## 升级与卸载

- **升级**：在插件目录执行 `git pull`。
- **停用**：在 Antigravity 的 Customizations 页面中关闭 **Session Title** 开关（即时生效，无需重启）。
- **卸载**：在 Customizations 页面卸载，或删除 `~/.gemini/config/plugins/session-title` 目录。

## License

[MIT](./LICENSE)
