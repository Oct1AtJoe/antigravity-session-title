#!/usr/bin/env node
/**
 * Validates and sets an Antigravity conversation title via ConversationService.
 * Uses ANTIGRAVITY_LS_ADDRESS, ANTIGRAVITY_CSRF_TOKEN, and ANTIGRAVITY_CONVERSATION_ID.
 */

const ALLOWED_TYPES = ['功能', '设计', '修复', '优化', '发布', '探索', '文档', '研究']
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const FORBIDDEN_PUNCTUATION = /[|｜，。！？、；：“”‘’"'（）()\[\]【】《》<>]/

function printUsage() {
  console.error(
    [
      'Usage: node set-title.mjs <title> [options]',
      '',
      'Options:',
      '  --conversation-id <id>  Target conversation ID (defaults to ANTIGRAVITY_CONVERSATION_ID)',
      '  --force                 Overwrite even if existing title already matches MMDD｜类型｜主题',
      '  --raw                   Skip MMDD｜类型｜主题 format validation',
      '  --dry-run               Validate and check current title without updating',
      '  -h, --help              Show this help message',
    ].join('\n'),
  )
}

function parseArgs(argv) {
  const options = {
    title: '',
    conversationId: process.env.ANTIGRAVITY_CONVERSATION_ID || '',
    force: false,
    raw: false,
    dryRun: false,
    help: false,
  }

  const positional = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--force') {
      options.force = true
    } else if (arg === '--raw') {
      options.raw = true
    } else if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '-h' || arg === '--help') {
      options.help = true
    } else if (arg === '--conversation-id') {
      const next = argv[++i]
      if (!next) throw new Error('--conversation-id requires a value')
      options.conversationId = next
    } else if (arg.startsWith('--conversation-id=')) {
      options.conversationId = arg.slice('--conversation-id='.length)
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`)
    } else {
      positional.push(arg)
    }
  }

  options.title = positional.join(' ').trim()
  return options
}

/** Validate MMDD｜类型｜主题 format and return { valid, reason? }. */
function validateTitle(title) {
  if (!title) return { valid: false, reason: 'Title is empty' }

  const parts = title.split('｜')
  if (parts.length !== 3) {
    return {
      valid: false,
      reason: 'Title must have 3 segments separated by full-width "｜" (MMDD｜类型｜主题)',
    }
  }

  const [mmdd, type, topic] = parts
  if (!/^\d{4}$/.test(mmdd)) {
    return { valid: false, reason: `Invalid date prefix "${mmdd}", expected MMDD` }
  }

  const month = Number(mmdd.slice(0, 2))
  const day = Number(mmdd.slice(2, 4))
  if (month < 1 || month > 12 || day < 1 || day > DAYS_IN_MONTH[month - 1]) {
    return { valid: false, reason: `Invalid calendar date "${mmdd}"` }
  }

  if (!ALLOWED_TYPES.includes(type)) {
    return {
      valid: false,
      reason: `Invalid type "${type}", expected one of: ${ALLOWED_TYPES.join(' / ')}`,
    }
  }

  const trimmedTopic = topic.trim()
  if (trimmedTopic !== topic || trimmedTopic.length < 2 || trimmedTopic.length > 20) {
    return {
      valid: false,
      reason: 'Topic must be 2-20 characters without leading/trailing spaces',
    }
  }

  if (FORBIDDEN_PUNCTUATION.test(trimmedTopic)) {
    return { valid: false, reason: 'Topic must not contain punctuation or quotes' }
  }

  const matchedTypeWord = ALLOWED_TYPES.find((word) => trimmedTopic.includes(word))
  if (matchedTypeWord) {
    return {
      valid: false,
      reason: `Topic must not contain type word "${matchedTypeWord}"`,
    }
  }

  return { valid: true }
}

async function callConversationService(lsAddress, csrfToken, method, body) {
  const url = `http://${lsAddress}/product.v1.ConversationService/${method}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Connect-Protocol-Version': '1',
      'x-antigravity-csrf-token': csrfToken,
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`${method} failed (HTTP ${res.status}): ${text}`)
  }
  return text ? JSON.parse(text) : {}
}

async function main() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (err) {
    console.error(err.message)
    printUsage()
    process.exit(1)
  }

  if (options.help) {
    printUsage()
    process.exit(0)
  }

  if (!options.title) {
    console.error('Missing <title> argument.')
    printUsage()
    process.exit(1)
  }

  if (!options.raw) {
    const check = validateTitle(options.title)
    if (!check.valid) {
      console.error(`Invalid title "${options.title}": ${check.reason}`)
      process.exit(1)
    }
  }

  const lsAddress = process.env.ANTIGRAVITY_LS_ADDRESS
  const csrfToken = process.env.ANTIGRAVITY_CSRF_TOKEN
  if (!lsAddress || !csrfToken) {
    console.error('Missing ANTIGRAVITY_LS_ADDRESS or ANTIGRAVITY_CSRF_TOKEN in environment.')
    process.exit(1)
  }
  if (!options.conversationId) {
    console.error('Missing conversation ID (pass --conversation-id or set ANTIGRAVITY_CONVERSATION_ID).')
    process.exit(1)
  }

  const current = await callConversationService(lsAddress, csrfToken, 'GetConversation', {
    conversationId: options.conversationId,
  })
  const currentTitle = current?.annotations?.title || ''

  if (!options.force && validateTitle(currentTitle).valid) {
    console.log(
      JSON.stringify({
        status: 'skipped',
        reason: 'already_formatted',
        conversationId: options.conversationId,
        currentTitle,
      }),
    )
    return
  }

  if (options.dryRun) {
    console.log(
      JSON.stringify({
        status: 'dry_run',
        conversationId: options.conversationId,
        currentTitle,
        nextTitle: options.title,
      }),
    )
    return
  }

  const updated = await callConversationService(lsAddress, csrfToken, 'UpdateConversation', {
    conversationId: options.conversationId,
    annotations: { title: options.title },
  })

  console.log(
    JSON.stringify({
      status: 'updated',
      conversationId: options.conversationId,
      title: updated?.annotations?.title || options.title,
    }),
  )
}

main().catch((err) => {
  console.error(err.message || String(err))
  process.exit(1)
})
