#!/usr/bin/env node
// Self-Improvement Error Detector Hook (PostToolUse, agent-agnostic).
//
// Post-tool-use hook for Bash/shell commands. Supported agents:
//   - Claude Code  (PostToolUse, matcher "Bash"):   payload field `tool_response`
//   - Codex CLI    (PostToolUse, matcher "Bash"):   payload field `tool_response`
//   - Copilot CLI  (postToolUse, no matcher):       payload field `toolResult.textResultForLlm`
//
// All three agents send the hook payload as JSON on stdin.
//
// Output channel differs by agent:
//   - Claude Code and Codex CLI: plain stdout from a post-tool hook is NOT shown
//     to the model; the reminder must be returned as JSON
//     `hookSpecificOutput.additionalContext`. Both accept the same shape.
//   - Copilot CLI: hook output is ignored entirely; this script is still safe to
//     register there (the JSON output is silently discarded).
//
// OS 非依存の Node 実装(jq / python に依存しない)。

const ERROR_PATTERNS = [
  'error:', 'Error:', 'ERROR:', 'failed', 'FAILED', 'command not found',
  'No such file', 'Permission denied', 'fatal:', 'Exception', 'Traceback',
  'npm ERR!', 'ModuleNotFoundError', 'SyntaxError', 'TypeError', 'exit code',
  'non-zero',
]

let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (c) => { input += c })
process.stdin.on('end', () => {
  let d = {}
  try { d = JSON.parse(input) } catch { d = {} }

  // Copilot's postToolUse has no matcher and fires for every tool; filter to
  // shell commands in-script. Claude Code / Codex are already filtered by the
  // "Bash" matcher, so this check just passes through.
  const toolName = d.tool_name || d.toolName || ''
  if (toolName && !/^(bash|shell)$/i.test(toolName)) process.exit(0)

  // Extract the tool output text across payload shapes.
  let output = d.tool_response ?? d.toolResult?.textResultForLlm ?? ''
  if (typeof output !== 'string') output = JSON.stringify(output)
  if (!output) output = input

  // Copilot reports failures explicitly; treat that as a direct signal.
  const resultType = d.toolResult?.resultType || ''

  const containsError = resultType === 'failure' || ERROR_PATTERNS.some((p) => output.includes(p))

  if (containsError) {
    const additionalContext = [
      '<error-detected>',
      'A command error was detected. Consider logging this to .learnings/ERRORS.md if:',
      '- The error was unexpected or non-obvious',
      '- It required investigation to resolve',
      '- It might recur in similar contexts',
      '- The solution could benefit future sessions',
      '',
      'Use the self-improvement skill format: [ERR-YYYYMMDD-XXX]',
      '</error-detected>',
    ].join('\n')
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext },
    }) + '\n')
  }
})
