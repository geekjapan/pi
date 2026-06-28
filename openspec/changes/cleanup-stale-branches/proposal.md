# Cleanup Stale Branches

## 概要

マージ済み・不要なリモートブランチとローカルブランチを削除する。

## 背景

text tool protocol 実装で使った feature ブランチや、OpenSpec review ブランチが残っている可能性がある。main に統合済みのブランチは削除して整理する。

## 変更内容

1. リモートブランチの確認と削除（マージ済みのもの）
2. ローカルブランチの確認と削除
3. `git remote prune origin` で stale ref を整理

## Non-goals

- branch protection の設定（Phase 1 の別作業）
