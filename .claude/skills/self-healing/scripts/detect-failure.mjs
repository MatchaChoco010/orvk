#!/usr/bin/env node
// detect-failure.mjs — PostToolUse hook for Bash invocations.
// Reads the tool result JSON on stdin (per Claude Code hook spec); if exit_code
// != 0, emits a system reminder pointing the agent at self-healing.
//
// Wire up in .claude/settings.json:
//   "hooks": { "PostToolUse": [{ "matcher": "Bash",
//     "hooks": [{ "type": "command",
//       "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/skills/self-healing/scripts/detect-failure.mjs\"" }] }] }
//
// OS 非依存の Node 実装(jq / python に依存しない)。

let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (c) => { input += c })
process.stdin.on('end', () => {
  let data = {}
  try { data = JSON.parse(input || '{}') } catch { data = {} }

  // Common shapes: {"tool_response": {"exit_code": N}} (Claude Code / Codex),
  // {"tool_result": {"exit_code": N}}, {"exit_code": N}, {"result": {"exit_code": N}}
  const paths = [
    ['tool_response', 'exit_code'],
    ['tool_result', 'exit_code'],
    ['exit_code'],
    ['result', 'exit_code'],
  ]
  let exitCode = 0
  for (const path of paths) {
    let d = data
    let ok = true
    for (const k of path) {
      if (d && typeof d === 'object' && k in d) d = d[k]
      else { ok = false; break }
    }
    if (ok && (typeof d === 'number' || typeof d === 'string')) {
      const n = parseInt(d, 10)
      if (!Number.isNaN(n)) { exitCode = n; break }
    }
  }

  // PostToolUse plain stdout is not shown to the model (Claude Code and Codex
  // alike); the reminder must be returned as additionalContext JSON.
  if (exitCode !== 0) {
    const additionalContext = [
      '<self-healing-trigger>',
      'A Bash command just exited non-zero. This is a heal opportunity.',
      '',
      'Before retrying the same command verbatim:',
      '  1. DIAGNOSE — read the error; identify the root cause (env? missing dep? wrong tool?)',
      "  2. Search .learnings/HEALS.md for a matching Pattern-Key (don't re-solve a solved problem)",
      '  3. PATCH — write the fix (or apply a known one)',
      '  4. VERIFY — re-run the command; require exit 0',
      '  5. FILE — append a HEAL entry to .learnings/HEALS.md via .claude/skills/self-healing/scripts/new-heal.mjs',
      '</self-healing-trigger>',
    ].join('\n')
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext },
    }) + '\n')
  }
})
