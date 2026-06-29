# Text Tool Protocol Smoke Results

Date: 2026-06-29

## Environment

- Installed `pi`: `0.80.2`
- Config dir: `/tmp/pi-sunna-agent`
- Base URL: `http://100.95.251.73`
- Protocol: `--tool-protocol text`
- Tools per model: `write`, `read`, `edit`, `bash`, `grep`, `find`, `ls`

## Models

| Provider | Port | Model | Result |
| --- | ---: | --- | --- |
| `sunna-ara` | 8080 | `gemma-4-31b-it-heretic-ara.Q8_0.gguf` | 7/7 pass |
| `sunna-qwen` | 8082 | `Qwen3.6-35B-A3B-abliterated-Q4_K_M.gguf` | 7/7 pass |
| `sunna-deepseek` | 8088 | `DeepSeek-R1-Distill-Llama-8B-abliterated.Q4_K_S.gguf` | 4/7 pass |
| `sunna-moe` | 8090 | `L3.2-8X3B-MOE-Dark-Champion-Inst-18.4B-uncen-ablit_D_AU-Q4_k_s.gguf` | 7/7 pass |

Dropped:

- 8084 was stopped before the final run.
- 8086 `LFM2.5-230M-abliterated.i1-Q6_K.gguf` was removed from the matrix because it usually did not emit executable tool calls.

## Final Tool Smoke Matrix

| Provider | write | read | edit | bash | grep | find | ls | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: |
| `sunna-ara` | pass | pass | pass | pass | pass | pass | pass | 7/7 |
| `sunna-qwen` | pass | pass | pass | pass | pass | pass | pass | 7/7 |
| `sunna-deepseek` | pass | pass | fail | pass | pass | fail | fail | 4/7 |
| `sunna-moe` | pass | pass | pass | pass | pass | pass | pass | 7/7 |
| Total | 4/4 | 4/4 | 3/4 | 4/4 | 4/4 | 3/4 | 3/4 | 25/28 |

## Parser Patterns Absorbed

- Canonical: `<tool_call>{"name":"read","arguments":{"path":"..."}}</tool_call>`
- Malformed start tag: `<tool_call{"name":"read","arguments":{"path":"..."}}>`
- Unclosed JSON body: `<tool_call>{"name":"write","arguments":{...}}`
- Name plus JSON args: `<tool_call>read{"path":"..."}`
- Name assignment plus JSON args: `<tool_call> read={"path":"..."}`
- Parenthesized: `(tool_call {"name":"write","arguments":{...}})`
- Slash-prefixed: `/tool_call{"name":"ls","arguments":{...}}`
- Fenced: ````tool_call ... ````
- XML-style attributes: `<tool_call name="edit" arguments={...}></tool_call>`
- XML-style body args: `<tool_call name="write">{...}</tool_call>`
- Top-level args without `arguments`: `{"name":"bash","command":"..."}`
- Pipe style: `<|tool_call>call:bash{command:"...",timeout:5}<tool_call|>`

## Failures Left As Model Output Errors

These were recorded but not normalized:

- DeepSeek `edit`: emitted paths with extra spaces or changed `edit.txt` to `file.txt`, causing `ENOENT`.
- DeepSeek `find`: emitted invalid JSON with a missing closing quote in the `path` string.
- DeepSeek `ls`: emitted a corrupted path containing a pipe-delimited duplicate path, causing `ENOENT`.
- Earlier LFM runs: mostly returned prose such as "DONE" without an executable tool call.
- Earlier MOE runs: sometimes emitted schema-like keys such as `path?` or `timeout?`; these are rejected instead of guessed.

## Validation

- `pi --version`: `0.80.2`
- `pi --list-models sunna`: listed `sunna-ara`, `sunna-qwen`, `sunna-deepseek`, `sunna-moe`
- Qwen prompt smoke: `ok`
- Tool smoke: `25/28 passed`
- `node node_modules/vitest/dist/cli.js --run test/text-tool-call.test.ts`: `31/31 passed`
- `node node_modules/vitest/dist/cli.js --run test/agent-loop.test.ts`: `33/33 passed`
- `npm run check`: passed
- `npm run e2e:critical`: `5/5 passed, 0 failed, 0 timeout`
