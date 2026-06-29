# Tasks

- [ ] deploy.sh に `generate_wrappers` 関数を追加（pi-dog, pi-text, pi-auto テンプレート出力 + chmod +x）
- [ ] deploy.sh の Step 12（symlink 更新）後に `generate_wrappers` を呼び出す
- [ ] DOGFOOD_ROOT のカスタム値が wrapper テンプレートに正しく埋め込まれることを確認
- [ ] pi-dog --version で current release の Pi が起動することを検証
- [ ] PI_CODING_AGENT_DIR override が効くことを検証
- [ ] 再 deploy で wrapper が上書き再生成されることを検証
