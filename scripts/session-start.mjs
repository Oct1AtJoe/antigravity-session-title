#!/usr/bin/env node
/**
 * Antigravity SessionStart hook: injects the session naming convention for new sessions.
 * No network calls and no file writes; outputs injectSteps JSON to stdout.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TYPES = ['功能', '设计', '修复', '优化', '发布', '探索', '文档', '研究']
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const SET_TITLE_SCRIPT = path.join(SCRIPT_DIR, 'set-title.mjs')

function readStdin() {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
    })
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', () => resolve(data))
  })
}

/** Return MMDD in Asia/Shanghai (fixed UTC+8 offset, no ICU dependency). */
function mmddShanghai(now = new Date()) {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(shifted.getUTCDate()).padStart(2, '0')
  return `${mm}${dd}`
}

function buildSystemMessage(mmdd) {
  return [
    '## 会话命名规范（session-title 插件）',
    '',
    '当前为新建会话。仅当你为主对话（非子代理）时，**必须**在输出第一轮最终文本回复之前（可与其他工具并行），调用 `run_command` 为本会话设置一次规范标题（即使首条消息只是 "hello" / "你好" / 测试消息，也必须命名，不要跳过）：',
    '',
    `1. 判断对话类型，只能取其一：${TYPES.join(' / ')}。`,
    '2. 提炼主题：2-8 个字，概括用户诉求，不得包含类型词，不含标点与引号；若首条消息仅是纯寒暄或测试（如 "hello" / "你好"），类型取 `探索`，主题取如 `日常问候` 或 `对话测试`。',
    `3. 标题格式严格为：\`${mmdd}｜类型｜主题\`（日期固定为 \`${mmdd}\`，分隔符使用全角 \`｜\`）。`,
    '4. 通过 `run_command` 执行以下命令完成改名（脚本会自动检查当前标题，已符合规范则跳过）：',
    `   \`node "${SET_TITLE_SCRIPT}" "${mmdd}｜类型｜主题"\``,
    '5. 每个会话只设置一次；此规则仅用于设置会话标题，不得改变你对用户的正常回复内容与语气。',
    '',
    '示例：',
    `- “登录接口偶尔 500，帮我查下” → \`${mmdd}｜修复｜登录接口超时\``,
    `- “帮我把设置页改成深色” → \`${mmdd}｜设计｜设置页深色主题\``,
    `- “看下这个仓库的构建流程” → \`${mmdd}｜探索｜构建流程梳理\``,
    `- “hello” / “你好” → \`${mmdd}｜探索｜日常问候\``,
  ].join('\n')
}

async function main() {
  const raw = await readStdin()
  if (raw.trim()) {
    try {
      JSON.parse(raw)
    } catch {
      process.exit(0)
    }
  }

  const output = {
    injectSteps: [
      {
        systemMessage: {
          systemMessage: buildSystemMessage(mmddShanghai()),
        },
      },
    ],
  }

  process.stdout.write(JSON.stringify(output))
}

await main()
