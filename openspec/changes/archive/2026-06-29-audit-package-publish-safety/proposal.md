# Audit Package Publish Safety

## 概要

monorepo 内の全パッケージの npm publish 安全性を棚卸しし、誤 publish を防止する。

## 背景

root package.json は `"private": true` で publish 抑止済みだが、個別パッケージ（`packages/*/package.json`）には `private` フラグがなく、upstream の `@earendil-works` scope の package 名がそのまま残っている。誤って `npm publish` すると upstream パッケージと衝突するリスクがある。

## 変更内容

1. 全 `packages/*/package.json` に `"private": true` を追加（publish 意図があるまで）
2. README に「package 名は upstream 保持、publish 禁止」の注意書きを追加
3. publish 関連スクリプト（`scripts/publish.mjs` 等）に safety check があるか確認

## Non-goals

- package 名の変更（将来の publish 判断時に決める）
- scope の変更
