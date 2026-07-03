#!/usr/bin/env node
// Self-Improvement Activator Hook (UserPromptSubmit)
// Reminds the agent to capture learnings. Plain stdout becomes injected context
// in Claude Code / Codex. Keep output minimal (~50-120 tokens).
//
// OS 非依存の Node 実装(jq / python に依存しない)。フックは
// `node <path>/activator.mjs` の形で起動する。
//
// stdin には UserPromptSubmit payload(直前のユーザープロンプトを含む)が来る。
// それを読み、ユーザーが「是正している」シグナルを検出したら、汎用文ではなく
// **その場で .learnings に記録せよ** という強いリマインダーを出す。毎ターン同文だと
// banner blindness で無視されるため、是正時だけ文面を変えて注意を引く。

import fs from 'node:fs'

let raw = ''
try {
  raw = fs.readFileSync(0, 'utf8')
} catch {
  raw = ''
}

// payload が JSON なら prompt 系フィールドを、そうでなければ raw 全体を走査対象にする。
let prompt = raw
try {
  const j = JSON.parse(raw)
  prompt = j.prompt || j.user_prompt || j.input || j.message || raw
  if (typeof prompt !== 'string') prompt = raw
} catch {
  // not JSON — use raw text
}

// ユーザーの是正・不満・確認要求のシグナル(日本語中心 + 英語少々)。
// 疑問形で詰める・「〜べき / 〜のはず / 〜しなさい / 確認したのか」等を拾う。
const CORRECTION = /(なんで|なぜ|どうして|違う|間違|おかしい|べきです|べきだ|はずです|はずだ|しなさい|しないでください|ではないですか|のではないですか|ないのですか|したのですか|そうではなく|勝手に|指示していません|重視して|正しくない|直しなさい|やり直|確認せず|確認して|wrong|incorrect|should have|you didn't|why did)/i

if (CORRECTION.test(prompt)) {
  process.stdout.write(`<self-improvement-reminder priority="high">
直前のユーザー発言は **是正・不満・確認要求の可能性が高い**。これは記録すべき学びである。
このタスクへの対応を終える前に、次を行うこと(「後で」でなくこのターンの成果物として扱う):
- 是正の要点(何を誤り、正しくは何か、なぜか)を \`.learnings/LEARNINGS.md\` に **correction** として追記する(ID \`LRN-YYYYMMDD-XXX\`、self-improvement スキルの Learning Entry 形式)。
- 恒久ルール化すべきものは CLAUDE.md / 該当 skill へ昇格(status: promoted)。
リマインダーを無視して記録を省略しない。
</self-improvement-reminder>
`)
} else {
  process.stdout.write(`<self-improvement-reminder>
After completing this task, evaluate if extractable knowledge emerged:
- Non-obvious solution discovered through investigation?
- Workaround for unexpected behavior?
- Project-specific pattern learned?
- Error required debugging to resolve?

If yes: Log to .learnings/ using the self-improvement skill format.
If high-value (recurring, broadly applicable): Consider skill extraction.
</self-improvement-reminder>
`)
}
