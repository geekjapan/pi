# Fix Public Repo Notices

## 概要

public repo であるにもかかわらず README と NOTICE に「private repository」「Before making this repository public」と記載されている矛盾を修正する。

## 背景

geekjapan/pi は earendil-works/pi の standalone derivative として public 公開済み。しかし README の Standalone repository notice セクションと NOTICE ファイルが private 前提の文言のまま残っている。これにより:

- 閲覧者に repo の状態を誤認させる
- upstream 公式と混同されるリスクがある

## 変更内容

1. **README.md** の Standalone repository notice セクションを更新
   - 「private repository」→「public standalone derivative」
   - 「Before making this repository public」→ publish/distribution 前の監査注意に変更
   - 「not affiliated with or endorsed by」を追加
2. **NOTICE** ファイルの「Standalone Private Copy」→「Standalone Derivative」に修正
   - 同様に private 前提文言を削除
3. **README.md** 冒頭の upstream ロゴ・バッジ・リンクを derivative として適切な表示に変更
   - upstream Discord/npm バッジを削除または注釈付きに変更
   - 冒頭に derivative であることを明記

## Non-goals

- package.json の name 変更（別 change で対応）
- repo description の変更（別 change で対応）
- package 境界の再設計（Phase 3 で対応）
