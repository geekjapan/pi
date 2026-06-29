# Self-Grill Report: Dogfood Pipeline Proposals

5 つの OpenSpec propose を横断的に検証した結果。

## 問題リスト

### 1. Wrapper テンプレートのパスが DOGFOOD_ROOT と不整合

- **問題**: wrapper-generation proposal.md の最初のテンプレート例では `$HOME/opt/pi-dogfood/current/pi` がハードコードされているが、後半の「修正版」で `$DOGFOOD_ROOT` を deploy 時展開に切り替えている。最初のテンプレートと修正版が共存しており、どちらが正しいか曖昧。
- **該当 change**: #28 (wrapper-generation)
- **深刻度**: Warning
- **解決案**: proposal.md の最初のテンプレートを削除し、修正版（`$DOGFOOD_ROOT` 展開版）のみ残す。design.md の heredoc escaping 判断と一致させる。

### 2. E2E runner の --binary に pi-test.sh を渡した場合のタイムアウト挙動

- **問題**: `--binary` 省略時は `pi-test.sh` を spawn する。`pi-test.sh` は `tsx` 経由で Pi を起動するため、起動が遅く 30s デフォルトタイムアウトに引っかかる可能性がある。deploy gate では `--binary` を明示指定するので問題ないが、`npm run e2e:critical` を開発中に使う場合にタイムアウトが発生しうる。
- **該当 change**: #25 (e2e-runner-foundation)
- **深刻度**: Warning
- **解決案**: proposal.md に「pi-test.sh 経由では tsx の起動コストがあるため、タイムアウトを長めに設定するか、`npm run build` 済みの dist/cli.js を直接指定することを推奨」と注記する。デフォルトタイムアウトの変更は不要（30s は tsx 起動込みでも十分なはず）。

### 3. `assertNoStackTrace` の false positive リスク

- **問題**: `assertNoStackTrace` は `at ` で始まる行を stack trace と判定するが、Pi の通常出力（例: "Look at the following code..."）が `at ` を含む場合に false positive になる。
- **該当 change**: #26 (complete-critical-e2e-scenarios)
- **深刻度**: Warning
- **解決案**: `^\s*at\s+\S+\s+\(` のようにファイルパスを含むパターンに限定する。または `at Object.<anonymous>`, `at Module._compile`, `at async` 等の Node.js 固有パターンに寄せる。ただし P0 シナリオでは `-p "hello"` 程度の入力なので "Look at" が出る確率は低い。実装時に調整可能。

### 4. deploy.sh の Step 番号と wrapper-generation の Step 番号がずれている

- **問題**: deploy.sh proposal は Step 1-13。wrapper-generation proposal は「Step 13（サマリー出力）の前に generate_wrappers を実装」と記述。しかし deploy.sh 側に wrapper 生成のステップが明示されていない。
- **該当 change**: #27 (deploy-script), #28 (wrapper-generation)
- **深刻度**: Warning
- **解決案**: deploy.sh の Step 12 と Step 13 の間に「Step 12.5: Wrapper 生成」を追加するか、wrapper-generation issue の acceptance criteria で deploy.sh に generate_wrappers 呼び出しを追加することを明記する。現状でも Issue の依存関係（#28 → #27）で暗示されているが、明示的にすべき。

### 5. rollback.sh の `readlink` が相対パスを返す可能性

- **問題**: `ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"` で作られる symlink は絶対パスを指すが、`readlink "$CURRENT_LINK"` の戻り値が相対パスの場合、`basename` は正しく動くが、rollback の比較ロジックで問題が起きうる。
- **該当 change**: #29 (rollback-status-scripts)
- **深刻度**: Info
- **解決案**: deploy.sh が `ln -sfn` に絶対パスを渡すことを design で明記。`RELEASE_DIR` は `$DOGFOOD_ROOT/releases/$COMMIT_SHA` で常に絶対パスなので、実際には問題にならない。

### 6. 同時 deploy の競合

- **問題**: 2 つのターミナルから同時に deploy.sh を実行した場合、staging dir は独立だが `mv "$STAGING/node" "$RELEASE_DIR"` で先着が勝ち、後着は `mv` が失敗する。`--force` の場合は `rm -rf` と `mv` の間にレースがある。
- **該当 change**: #27 (deploy-script)
- **深刻度**: Info
- **解決案**: 個人利用の dogfood では同時 deploy は想定外。proposal に「同時 deploy は未対応。個人利用を前提とする」と明記するだけで十分。

### 7. deploy.sh の EXIT trap と staging cleanup の相互作用

- **問題**: Step 10 で `mv "$STAGING/node" "$RELEASE_DIR"` の後、staging dir は空（`node/` 以外は `tarballs/` と `bun/`）。EXIT trap の `rm -rf "$STAGING"` は成功するが、deploy 成功後も残りの staging ファイル（tarballs, bun）を掃除する。これは正しい挙動。
- **該当 change**: #27 (deploy-script)
- **深刻度**: Info
- **解決案**: 問題なし。trap が staging 全体を cleanup するのは意図通り。

### 8. .deploy-info の共有契約が全 propose で一致

- **問題なし**: deploy.sh (#27) が `COMMIT`, `DATE`, `BRANCH` の KEY=VALUE を書き、rollback.sh/status.sh (#29) が `source` で読む。フォーマットは 3 propose で一致。
- **深刻度**: (確認済み — 問題なし)

### 9. DOGFOOD_ROOT のデフォルト値が全 propose で一致

- **問題なし**: 全スクリプトで `${DOGFOOD_ROOT:-$HOME/opt/pi-dogfood}` を使用。
- **深刻度**: (確認済み — 問題なし)

### 10. E2E gate のインターフェース整合

- **問題なし**: deploy.sh (#27) は `node scripts/e2e/run-e2e.mjs --binary "$STAGING/node/pi" --critical` を呼ぶ。run-e2e.mjs (#25) は `--binary` と `--critical` をサポート。パスは `$STAGING/node/pi` で、`createPiShim()` が作る shim の位置と一致。
- **深刻度**: (確認済み — 問題なし)

### 11. PI_CODING_AGENT_DIR のデフォルト値が一致

- **問題なし**: wrapper (#28) で `$HOME/.config/pi-dogfood`。config.ts の `getAgentDir()` は env var を優先読み。
- **深刻度**: (確認済み — 問題なし)

### 12. `--no-session` と `--offline` の追加が #25 のシナリオインターフェースで未記載

- **問題**: #26 の各シナリオは `--no-session` と `--offline` を使うが、#25 の proposal/design にはこれらのフラグへの言及がない。runner 自体には影響しないが（exec に渡す引数はシナリオ側の自由）、version-check.mjs は `--version` だけなので使わない。整合性の問題ではないが、#26 のシナリオが#25 の設計に暗黙に依存しない確認として記録。
- **該当 change**: #25, #26
- **深刻度**: Info
- **解決案**: 問題なし。exec の引数はシナリオが自由に決めてよい設計。

## まとめ

- **Critical (apply ブロック)**: **なし**
- **Warning**: 4 件（#1 テンプレート不整合、#2 タイムアウト注記、#3 stack trace 検出精度、#4 Step 番号ずれ）
- **Info**: 4 件（#5 readlink、#6 同時 deploy、#7 trap、#12 フラグ言及）

Warning はいずれも実装時に自然に解決できるレベル。apply をブロックする Critical 問題はない。
