# Buffer → TikTok 下書き連携

対象は TikTok `@opengroundcoffee`。生成済み MP4 と既存の Instagram 用キャプションを再利用し、Buffer に動画の下書きを作る。公開・予約・既存投稿の変更・削除は実装していない。初期状態は無効。

## 動作

- `post-sns.mjs` に任意の下書き処理を追加した。既存の GitHub Release に動画を保存した後、YouTube / Instagram の処理に続いて実行する。`BUFFER_DRAFTS_ENABLED=true` の場合だけ有効。
- 通常の pipeline の dry run は SNS 処理に到達しない。下書き側も `DRY_RUN=true` なら認証・ファイル読み込み・通信前にスキップする。
- 対象チャンネルの ID・組織 ID・service=`tiktok`・handle・接続状態を照合する。handle から ID を推測しない。
- GraphQL `createPost` に `saveToDraft: true`、`needsApproval: false` を固定する。`dueAt` は送信しない。必須項目の `mode: addToQueue` は API の入力形式上必要だが、`saveToDraft` が予約を無効にする。`schedulingType` は `notification` に固定する。
- 応答が `status=draft` かつ `dueAt=null` の場合だけ成功と記録する。AI 生成の音声・画像を含むため `metadata.tiktok.isAiGenerated=true` を送る。動画内 1500 ms をサムネイル候補にする。
- Buffer の失敗は既存の YouTube / Instagram 投稿処理の成否に加えず、ログに確認要求を残す。下書きだけを再確認する際は下記の単独コマンドを使う。`post-sns` / pipeline 全体の再実行は既存プラットフォームの投稿も動かすため、下書きの再試行には使わない。
- 下書きの証跡は main 上の `data/buffer-draft-receipts.json` に保存する。checkout 内の古いコピーは使わず、GitHub API で毎回読む。`performance-history.json` の公開記録や PDCA の公開済み件数には加えない。

## 認証前にできる確認

Node 22 以上。既存の動画ファイルと、その動画の生成時に保存した captions JSON を指定する。下記は通信も書き込みも行わず、予定の入力と動画 SHA-256 を表示する。実 ID が未設定なら `UNCONFIGURED` と表示する。

```sh
npm run buffer-draft -- \
  --video=output/coffee-YYYYMMDD.mp4 \
  --video-url=https://github.com/nannantown/coffee-daily-video/releases/download/vYYYYMMDD/coffee-YYYYMMDD.mp4 \
  --captions=output/coffee-YYYYMMDD-captions.json
```

通常の生成直後なら `--captions=output/captions.json` でもよい。日付と動画ファイル名が一致しなければ停止する。日付が同じでも後から別の原稿で生成し直した captions JSON は使用しない。単独コマンドは `--write-draft` がなければ、認証用の環境変数があってもプレビューだけを返す。`--dry-run` は `--write-draft` より優先する。

## 認証と将来の有効化

**キー作成、OAuth の許可、継続アクセス、GitHub Secrets / Variables の設定は、ユーザーの承認後に行う。この実装は認証の作成や設定、有効化を自動では行わない。認証情報は実行環境の Secret から渡し、チャットやログに取り出さない。**

現行 API は `https://api.buffer.com` の GraphQL、認証は Bearer トークン。個人 API キーは Buffer の Settings → API から作成できる。2026-10-15 に確認した **New Key** 画面では、個人キーでも permission チェックボックスで操作 scope を選べる。下書き機能に必要な最小構成は `account:read`・`posts:read`・`posts:write` の3つ。

操作 scope と、アクセス先の組織・チャンネルの範囲は別の制約。個人キーはアカウント内の全組織・全チャンネルを対象とし、組織単位には制限できないため、コード側でも対象 ID・組織・handle を照合する。「全組織対象」は「すべての操作権限が必須」という意味ではない。[公式認証ガイドの対象範囲](https://developers.buffer.com/guides/authentication.html)

必要な操作は `account:read`（対象チャンネル確認）、`posts:read`（重複・結果確認）、`posts:write`（下書き作成）。この組み合わせでの実接続は認証後に検証する。`posts:write` は下書き専用権限ではない。`account:write`、ideas・snippets・insights・engagements の権限は使わない。

OAuth を使う場合もこれら3つの scope が最小構成の候補になる。OAuth クライアント登録・PKCE フロー・トークン更新はこの実装に含まない。OAuth で継続運用する場合は別途 `offline_access` と更新処理が必要になる。今回の最短手順は個人 API キーを `BUFFER_ACCESS_TOKEN` に保存する方法。[公式の scope 一覧](https://developers.buffer.com/guides/authentication.html)

### ユーザー自身がキーを保存する最短手順（承認後）

1. 対象の Buffer アカウントで [Settings → API](https://publish.buffer.com/settings/api) → **New Key** を開く。下書き確認だけなら `account:read`・`posts:read`・`posts:write` の3つを選ぶ。分析用の追加権限は別目的の承認範囲として扱う。有効期限は **30 days を推奨**するが、これは実キーの設定値を示すものではない。2026-10-15 に30日を選んだ場合は2026-11-14になるという計算例であり、保存済みキーの確定した期限ではない。キーはチャットやスクリーンショットに出さない。
2. [coffee-daily-video の Actions Secrets](https://github.com/nannantown/coffee-daily-video/settings/secrets/actions) → **New repository secret** を開く。Name は `BUFFER_ACCESS_TOKEN`、Secret 欄にキーを直接貼り付けて保存する。コード、通常の repository variable、ターミナル引数には入れない。
3. 保存が終わったことだけを伝える。キーの値は送らない。この時点では `BUFFER_DRAFTS_ENABLED` を作らず、下書き連携は無効のままにする。
4. 下記の専用 workflow の `inspect` で対象 TikTok のチャンネル ID・組織 ID を確認する。一件だけの作成確認にはその ID を workflow の入力に使い、Variables の設定は不要。日次連携を設定する場合だけ、確認済み ID を [Actions Variables](https://github.com/nannantown/coffee-daily-video/settings/variables/actions) の `BUFFER_CHANNEL_ID` と `BUFFER_ORGANIZATION_ID` に保存する。名前から ID を推測しない。
5. 修正のレビュー・反映、承認された一件の下書き確認が済み、継続アクセスも承認した後にだけ、同じ Variables で `BUFFER_DRAFTS_ENABLED=true` を設定する。予約や公開をする設定は追加しない。一件だけの接続確認は、継続設定を有効にする前に承認済み環境で行う。

保存済みキーの最終的な scope 一覧・有効期限は未確認。API 操作の成功から設定一覧や期限を推定しない。ユーザー本人が秘密値を表示・共有せずに設定画面の非秘密メタデータで確認する。

個人キーの自動更新は行わない。実際に設定された期限の前にユーザー自身で承認済みの必要権限を持つキーを作成し、同じ repository secret を更新する。30日固定の前提は置かない。期限が切れた場合は認証エラーで停止し、権限を自動で広げない。

Buffer 側には API キー作成が可能な対象アカウントへのログイン権限、GitHub 側にはこの repo の Actions Secrets / Variables を管理できる権限が必要。CI の保存処理は自動提供される `GITHUB_TOKEN` の既存 `contents: write` を使う。追加の GitHub PAT、`workflows: write`、管理者権限や保護ルールの迂回は不要。main の保護ルールが bot によるデータ更新を拒否する場合は、Buffer 作成前に止まるため、規則に沿った運用可否を別途確認する。[GitHub Contents API の権限と更新条件](https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents)

将来、有効化する際に必要な環境変数:

| 名前 | 内容 |
|---|---|
| `BUFFER_DRAFTS_ENABLED` | 明示的に `true` とした場合だけ作成可能 |
| `BUFFER_ACCESS_TOKEN` | 承認済み Bearer トークン。ログ・Git・引数に残さずシークレット管理から渡す |
| `BUFFER_CHANNEL_ID` | 確認済み TikTok チャンネル ID |
| `BUFFER_ORGANIZATION_ID` | そのチャンネルを所有する確認済み組織 ID |
| `BUFFER_DRAFT_STATE_BACKEND` | workflow が `github` に固定。実送信の入口は GitHub 保存のみを許可 |
| `GITHUB_TOKEN` | CI 自動提供。receipt の読み取り・条件付き更新に使用。既存の `contents: write` の範囲 |
| `GITHUB_REPOSITORY` | CI 自動提供。`nannantown/coffee-daily-video` との一致が必須 |

承認・設定・反映が済んだ後だけ、単独コマンドに `--write-draft` を付けて実 API に下書きを作成できる。単独コマンドも必ず同じ GitHub receipt を使うため、別のローカル state で CI の送信記録を回避できない。Mac で単独の実送信を行う場合も、承認済みの repo 限定 GitHub 認証（Contents の read/write）が必要。既存の `gh` 認証を自動流用しない。

## CI の永続化と既存 workflow との整合

`data/buffer-draft-receipts.json` の初期ファイルを PR とともに導入する。内容は空の `entries` で、投稿実績は補完しない。実行時は main 上のこのファイルを GitHub Contents API で読み、現在の blob SHA を指定して条件付き PUT する。保存先とブランチは固定する。キャッシュ・artifact の保存終了待ち・runner のローカルファイルには依存しない。

送信前の `creating` が commit として確定した応答を受け取るまで `createPost` を呼ばない。同時に同じ古い SHA を読んだ二つの実行は、一方の更新だけが成功する。競合時の再取得・上書きは行わず、その実行を止める。Buffer 成功後の保存が失敗しても、遠隔の `creating` が次回の再送を止める。読み取り・書き込み・応答確認・権限・サイズ制限のいずれかが失敗した場合もローカル保存に切り替えない。ファイル欠落や壊れたエントリを空の台帳として初期化しない。

workflow に ref ごとの `concurrency` と `cancel-in-progress: false` を追加する。実行中の投稿処理を後続実行で中断しない。別 workflow や手動の単独コマンドからの競合も、遠隔 SHA の照合で防ぐ。concurrency の待機順には依存しない。[公式 concurrency 仕様](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)

receipt 更新は単一のデータファイルだけを `[skip ci]` 付きの commit として main に保存する。既存の performance-history 保存 step はそのまま `git pull --rebase origin main` でこれらの commit を取得してから history を push できる。既存の workflow trigger は schedule / dispatch / `.recovery-trigger` の push のままで、receipt commit を契機に投稿し直す経路は追加しない。main への runtime データ更新は既存の history 更新と同じ `contents: write` を使い、workflow や認証設定を API で変更しない。

## 日次連携を有効にせず、一件だけ確認する

**Buffer TikTok Draft Check** (`.github/workflows/buffer-draft-check.yml`) を使う。手動実行のみで、main・この repo・この workflow 名をスクリプトでも照合する。`pipeline.mjs` や `post-sns.mjs` は呼ばず、動画の生成・Release の上書き・YouTube / Instagram 投稿は行わない。追加の Secret / PAT / repository variable は不要。`BUFFER_DRAFTS_ENABLED` は変更しない。

1. `operation=inspect`（既定値）で実行する。Secret は Actions の環境変数からだけ読み、アカウントの組織 ID とチャンネル情報を照合する。対象 `@opengroundcoffee` が一意で接続済みの場合だけ、非秘密のチャンネル ID・組織 ID を結果に出す。作成・台帳更新・メディア取得は行わない。
2. 承認した一件について `operation=create-draft` を選び、確認済みの `expected_channel_id`・`expected_organization_id`、既存 Release の日付、`confirmation=CREATE_ONE_DRAFT` を指定する。動画と同時に保存された captions JSON を匿名で取得し、日付・動画の識別情報を確認して同じ永続 receipt 経路で一件だけ下書きを作る。
3. 作成後は読み取りだけを繰り返し、`status=draft`・`dueAt=null`・`sentAt=null`・公開先 URL なしを確認する。動画の処理フラグが false で、長さと縦横サイズが正なら `ingestion=metadata_ready` と報告する。これは API の動画メタデータ確認であり、UI 上での再生確認とは分ける。
4. 処理中・確認失敗・作成結果不明のときは create を再実行しない。ID が返った場合は `operation=status` と `post_id`、確認済みの対象 ID を指定して読み取りだけを行う。ID が不明なら永続 receipt と Buffer 側の証跡を確認する。

結果は Secret や生の API エラーを含まない `output/buffer-draft-check.json` と step summary に保存する。投稿 ID、確認した状態、処理状態、非秘密の動画メタデータ、作成リクエスト数だけを報告し、CDN の一時 URL やトークンは出力しない。結果 artifact の期限は14日で、永続 receipt の保存期間とは独立している。キーの追加の分析権限は、この確認では使わない。

## 二重作成・結果不明時の扱い

識別子は `channelId:動画の日付`。MP4 の SHA-256・キャプション・送信条件をまとめた fingerprint を保持する。同じ日付を別の内容に差し替えて再実行しても、既存下書きを更新・追加せず停止する。

作成前にチャンネル内の**全状態**の投稿をページングして照合する。動画 URL とキャプションの両方が一致する下書きは再利用する。片方だけ一致・複数一致・予約済み・公開済みは確認待ちで停止する。caption だけが同じ過去動画も保守的に停止対象になる。

receipt に `creating` を遠隔保存してから作成を一度だけ送る。成功時は post ID を保持し、再実行ではその ID を読み直す。API が明示的に入力不正・未認可・不存在・制限超過を返した場合だけ `rejected` とし、次回の重複確認後に再試行できる。タイムアウト、HTTP エラー、GraphQL のトップレベルエラー、予期しない応答は `unknown` とし、自動再送しない。`unknown` の保存に失敗した場合も先行する `creating` は残る。

`unknown` / 作成途中で停止した `creating` は、同一の遠隔下書きが確認できたときだけ回復する。検索結果に現れなくても「作成されなかった」とは判断しない。記録済み ID が消えた場合も自動で作り直さない。Buffer が取り込み時に動画 URL を変換して一致を確認できなければ、そのまま確認待ちにする。

`receipt_store_conflict` は別実行による更新を示す。古いコピーを上書きせず、次の確認は必ず遠隔の最新状態を読み直す。`unknown` / `creating` を消して作成し直す運用は禁止。Buffer の UI / 読み取り API で post ID・動画・内容・状態を確認し、未作成と確認できた場合だけ人が再試行方法を判断する。送信前の GitHub 保存だけが結果不明になった場合も保守的に停止するため、実際は未送信でも確認待ちになる場合がある。

公式の channel-specific `createPost` には冪等キーがないため、履歴の削除・巻き戻し、別実装からの Buffer 書き込みまでは保証できない。receipt は削除・期限切れ・自動 pruning の対象にしない。900 KB を超える場合は送信前に止める。URL 変換や投稿編集で照合できなくなる場合も安全側で停止する。同日の再生成で MP4 の SHA が変わる場合も、既存 receipt との不一致で停止する。[API リファレンス](https://developers.buffer.com/reference.html)

## 動画 URL と検証

Buffer の動画入力は匿名アクセスできる直接 URL が必要。バイナリアップロード処理は追加していない。この repo の日付付き GitHub Release の MP4 URL のみを受け付け、作成前に認証ヘッダーなしで HEAD を確認する。GitHub の `application/octet-stream` 応答・リダイレクトの実際の取り込みは、初回の下書き作成で検証する。HEAD 成功は動画の取り込み成功や TikTok の公開可否を意味しない。下書き用コードは release を作成・上書きしないが、既存の SNS orchestrator は同日 release を再利用するときに上書きする。動画 SHA はローカルファイルの識別用で、遠隔 asset の同一性を保証するものではない。認証後に一件の下書きで内容を確認する必要がある。[公式メディア仕様](https://developers.buffer.com/guides/hosting-media.html)、[動画入力例](https://developers.buffer.com/examples/create-video-post.html)、[下書きの仕様](https://developers.buffer.com/examples/create-draft-post.html)

2026-10-15 に [10月15日の公開 MP4](https://github.com/nannantown/coffee-daily-video/releases/download/v20261015/coffee-20261015.mp4) を認証なしで読み取り検証した。HEAD は 200、7,946,004 bytes、`application/octet-stream`。`release-assets.githubusercontent.com` へ 302 で移動し、Range GET は 206、先頭64 bytes の `ftyp` が MP4 と一致した。署名付きの一時リダイレクト URL は入力に使わず、元の安定した Release URL を渡す。Buffer 側の成否は専用 workflow の結果と、必要に応じた UI 再生確認で判断する。

モックによる回帰テスト:

```sh
node --test scripts/buffer-draft.test.mjs
node --test scripts/buffer-draft-state.test.mjs
npm test
```

対象制限、下書き固定、無効時と dry run の無通信、receipt の先行保存、二重実行、タイムアウト後の停止・照合回復、確定拒否後の再試行、予約・公開・削除済み、内容変更、破損ファイル、ページング異常、機密値を含む API エラーの非表示を検証する。CI 用のテストは Git blob SHA を計算するインメモリ Contents API を使い、別 runner、同一 SHA の同時読み取り、送信前の保存失敗・応答喪失、送信後の保存失敗、別 receipt の競合更新、最終応答喪失を検証する。実 Buffer アカウントの権限、GitHub 書き込みの許可、動画取り込み、画面上の下書き確認は追加承認後に実施する。
