# SNS 連携ハンドオフドキュメント

作成: 2026-04-17 / 目的: YouTube と Instagram の自動投稿を直した際の全文脈を別セッションに引き継ぐ

---

## TL;DR

- 毎日 08:30 JST に動画を自動生成して YouTube Shorts と Instagram Reels に投稿する。
- 今日までは **Instagram は一度も投稿できていなかった**、**YouTube は 4/13 以降 auth エラーで止まっていた**。両方直して稼働中。
- 壊れる可能性がある主要箇所は「OAuth トークンの失効/不一致」「GitHub Secret の書き込み権限」「Meta の URL fetch 失敗」。全てフォローアップ可能な形で対処済み。

---

## システム構成

### 動画パイプライン全体像

```
cron (23:30 UTC) → daily-video.yml
  → pipeline.mjs
    1. fetch-stats.mjs            # 過去動画の統計取得 (任意)
    2. scrape-coffee-news.mjs     # 本日のコーヒー銘柄決定
    3. generate-data.mjs          # ナレーションテキスト生成
    4. generate-audio.mjs         # Edge TTS で音声生成
    5. generate-bgm.mjs           # BGM 生成
    6. remotion render            # 動画 (1080x1920 縦)
    7. post-sns.mjs
       a. generate-caption.mjs
       b. createGitHubRelease()   # 動画を Release asset に保管 (アーカイブ用途)
       c. uploadYouTube(videoPath)
       d. uploadInstagram(videoPath)   # ← 今は local path を渡す
    8. record-upload.mjs          # 統計トラッキング
```

### 関連 GitHub Workflow

| Workflow | トリガー | 役割 |
|---|---|---|
| `daily-video.yml` | cron `30 23 * * *` (08:30 JST) / workflow_dispatch | 毎日の動画生成と SNS 投稿 |
| `refresh-instagram-token.yml` | cron `0 0 * * 0` (毎週日曜) / workflow_dispatch | IG long-lived token を 60日延長 |
| `test-instagram-upload.yml` | workflow_dispatch | IG 投稿だけを再現テスト (YouTube 重複投稿を避けるため) |

### GitHub Secrets 一覧 (2026-04-17 時点)

| Secret | 用途 | 設定タイムスタンプ | 備考 |
|---|---|---|---|
| `SNS_POST_ENABLED` | 投稿処理の有効化フラグ | 2026-04-13 | `"true"` なら post-sns 動作 |
| `YOUTUBE_CLIENT_ID` | OAuth Client ID | 2026-04-13 | Client "Coffee Video CLI" |
| `YOUTUBE_CLIENT_SECRET` | OAuth Client Secret | 2026-04-13 | 同上 |
| `YOUTUBE_REFRESH_TOKEN` | OAuth Refresh Token | 2026-04-17 | 同じクライアントで発行済み（不一致解消済） |
| `INSTAGRAM_ACCESS_TOKEN` | FB User Long-lived Token | 2026-04-17 (週1 自動更新) | 60日で失効→自動延長 |
| `INSTAGRAM_USER_ID` | IG Business Account ID | 2026-04-17 | `17841464767833513` |
| `FACEBOOK_PAGE_ID` | FB Page ID | 2026-04-17 | `1149844638201593` |
| `FACEBOOK_APP_ID` | Meta App ID | 2026-04-10 | `1567718357640275` |
| `FACEBOOK_APP_SECRET` | Meta App Secret | 2026-04-10 | Token refresh に使用 |
| `GH_PAT` | Fine-grained PAT | 2026-04-17 | workflow から secret を書き戻す用。期限 2027-04-16 |

### ローカルで参照される OAuth 認証情報 JSON

- `~/Downloads/client_secret_904837708941-etnqlmapvfuradrdbm0fj7b90tkf8fs4.apps.googleusercontent.com.json` (新クライアント "Coffee Video CLI")
- `~/Downloads/client_secret_904837708941-mfkk84nne0ill90bjam8mcaapsjlgsrc.apps.googleusercontent.com.json` (旧クライアント "GitHub Trending Video CLI"、非推奨)

---

## YouTube 連携

### OAuth 構成

- **Google Cloud プロジェクト**: `github-trending-video`
- **OAuth Client (デスクトップ)**: `Coffee Video CLI` (904837708941-etnq…)
- **OAuth 同意画面の公開ステータス**: **本番環境 (Production)** ← 2026-04-17 に切り替え
  - Testing のままだと Refresh Token が **7日で失効**する。本番なら未使用 6ヶ月まで持つ。
  - アプリは「未確認」だが個人用なので初回認証時に「詳細 → 安全でないページに移動」で進めればよい。
- **スコープ**: `youtube.upload`, `youtube.readonly`

### 再認証手順 (Refresh Token を取り直す必要が出たら)

```bash
# 1. Client ID / Secret を env に出す
export YOUTUBE_CLIENT_ID=$(python3 -c "import json; print(json.load(open('/Users/kokinaniwa/Downloads/client_secret_904837708941-etnqlmapvfuradrdbm0fj7b90tkf8fs4.apps.googleusercontent.com.json'))['installed']['client_id'])")
export YOUTUBE_CLIENT_SECRET=$(python3 -c "import json; print(json.load(open('/Users/kokinaniwa/Downloads/client_secret_904837708941-etnqlmapvfuradrdbm0fj7b90tkf8fs4.apps.googleusercontent.com.json'))['installed']['client_secret'])")

# 2. loopback redirect フローで認証
node scripts/auth-youtube.mjs
# → ブラウザが開く → opengroundcoffee@gmail.com でサインイン
# → 「安全でないページに移動」→ YouTube 権限を許可
# → output/youtube-refresh-token.txt に Refresh Token が保存される

# 3. GitHub Secret 更新
cat output/youtube-refresh-token.txt | gh secret set YOUTUBE_REFRESH_TOKEN
```

### `scripts/auth-youtube.mjs` の注意点

Google は 2022 年 10月以降、新規 OAuth クライアントで **OOB フロー** (`urn:ietf:wg:oauth:2.0:oob`) を廃止した。今のスクリプトは **ephemeral loopback HTTP サーバー** を立てて `http://127.0.0.1:PORT` を redirect URI に使う方式。古い OOB 実装に戻してはいけない。

### `scripts/upload-youtube.mjs`

変更なし。OAuth2Client が USER token でそのまま動く。

---

## Instagram 連携

### 全体フロー

```
[週次] refresh-instagram-token.yml
  user long-lived token を fb_exchange_token で 60日延長
  → GH_PAT で INSTAGRAM_ACCESS_TOKEN secret に自動書き戻し

[日次] post-sns.mjs → upload-instagram.mjs --file=path
  1. GET /{FACEBOOK_PAGE_ID}?fields=access_token
     → Page Access Token を派生
  2. POST /{IG_USER_ID}/media?media_type=REELS&upload_type=resumable
     → { id, uri: "https://rupload.facebook.com/…" }
  3. POST {uri} (binary body, headers: Authorization: OAuth …, offset, file_size)
     → 動画バイナリを直接送信
  4. 状態 polling で FINISHED を待つ
  5. POST /{IG_USER_ID}/media_publish { creation_id }
     → 公開完了
```

### 主要 ID

- **Meta App**: `Social Media Manager` (ID `1567718357640275`)
- **FB Page**: `Open Ground Coffee` (ID `1149844638201593`)
- **IG Business Account**: `open_ground_coffee_roasters` (ID `17841464767833513`)
- IG 認証ユーザー: `opengroundcoffee@gmail.com` (Nan Nan)

### Token 再発行手順 (60日以上放置で完全失効した場合)

```
1. https://developers.facebook.com/tools/explorer/ を開く
2. Meta アプリ: Social Media Manager を選択
3. ユーザートークン
4. Permissions に以下を入れる:
   - pages_show_list
   - instagram_basic
   - instagram_manage_comments
   - instagram_content_publish
   - pages_read_engagement
5. Generate Access Token
6. Copy Token ボタンで短期トークンをクリップボードへ
7. そのトークンを短期のまま secret にセット:
   pbpaste | gh secret set INSTAGRAM_ACCESS_TOKEN
8. Refresh workflow を回して 60日延長:
   gh workflow run refresh-instagram-token.yml
```

`FACEBOOK_APP_SECRET` はすでに secret に入っており、refresh workflow 内部で自動使用される。ローカルで secret を取る必要はない。

### なぜ Page Access Token を使うか

IG Business Account が **Business Portfolio 所有の Page** に紐付いている場合、`/media` と `/media_publish` を **プレーンな User token で叩くと `(#10) Application does not have permission for this action` が返る**。Page Access Token を User token から派生させて使うと通る。

Page token は長期 User token から派生したものであれば実質失効しない (ユーザーのパスワード変更や権限剥奪で失効)。毎回実行時に派生すれば良いのでキャッシュ不要。

### なぜ resumable upload を使うか

URL 指定の `POST /media` (`video_url` パラメータ) は、Meta 側のフェッチャが **GitHub Release の 302 リダイレクトに失敗する**。Google CDN の公開 mp4 ですら `2207076 Media upload has failed` になる。ホスティング先を変えるより、**binary を rupload.facebook.com に直接 POST する resumable** に切り替えるのが確実。

### Container 状態の意味

| `status_code` | 意味 |
|---|---|
| `IN_PROGRESS` | Meta 側で処理中。polling 継続 |
| `FINISHED` | 公開可能。`/media_publish` を呼べる |
| `ERROR` | 失敗。`status` フィールドにサブコード |
| `EXPIRED` | 未公開のまま 24時間経過で破棄 |
| `PUBLISHED` | 公開済み |

---

## Token 自動リフレッシュの構造

### `refresh-instagram-token.yml` の仕組み

```yaml
env:
  GH_TOKEN: ${{ secrets.GH_PAT }}   # GITHUB_TOKEN では secret 書き込み不可
```

`gh secret set INSTAGRAM_ACCESS_TOKEN --body "$NEW_TOKEN"` は、Repository secrets への書き込みを必要とする。GitHub Actions のデフォルト `GITHUB_TOKEN` には **secrets:write 権限が無い**。よって `GH_PAT` (Fine-grained PAT, Secrets: Read and write, 対象 `nannantown/coffee-daily-video` 1リポジトリ, 2027-04-16 失効) を使う。

PAT が失効したら (1年後) 再発行:

```
1. https://github.com/settings/personal-access-tokens/new
2. Name: coffee-daily-video-secret-writer
3. Expiration: Custom, 1 年先
4. Repository access: Only select repositories → coffee-daily-video
5. Permissions → Repository permissions → Secrets: Read and write
6. Generate token
7. PAT 値をコピーして: echo "github_pat_..." | gh secret set GH_PAT
```

### トークン系の寿命カレンダー

| Token | 寿命 | 自動更新 |
|---|---|---|
| YouTube Refresh Token | 6ヶ月以上未使用で失効 | なし (毎日使うので実質無限) |
| IG Long-lived User Token | 60日 | 週1 で `refresh-instagram-token.yml` が `fb_exchange_token` で延長 |
| FB Page Access Token | User token 次第 | 上記と連動 (毎回派生) |
| `GH_PAT` | 1年 (2027-04-16) | 手動で再発行 |
| OAuth 同意画面 Publishing 状態 | 本番なら無期限 | 手動管理 |

---

## 動画エンコーディングの注意

### `remotion.config.ts`

```ts
Config.setPixelFormat("yuv420p");
```

Remotion はデフォルトで `yuvj420p` (JPEG フルレンジ) で書き出すが、Instagram は拒否する。必ず `yuv420p` に固定する。

### 出力スペック (参考)

- コンテナ: MP4
- 映像: H.264 High profile, Level 4.0, 1080x1920, 30fps, yuv420p
- 音声: AAC LC, 48kHz, stereo
- 尺: 約 49秒 (Opening 4s + project-1 12s + project-2 18s + project-3 8s + Ending 6s + padding)

---

## 過去の失敗モードと教訓

### YouTube `unauthorized_client`

- 旧クライアント "GitHub Trending Video CLI" で発行した Refresh Token と、後から更新された新クライアント "Coffee Video CLI" の Client ID/Secret が不一致だった。
- 教訓: **Client ID/Secret を差し替えたら Refresh Token も同じクライアントで取り直す**。Google Cloud Console の OAuth Client 一覧画面に複数クライアントが並んでいる場合は要注意。

### IG `Session has expired`

- 旧 refresh workflow は cron `0 0 1,15 * *` (月2回) で、60日失効と月2回更新では窓を跨ぐ可能性があった。
- 教訓: **60日トークンは週1更新**。最大でも15日に一度は触る。

### IG `(#10) Application does not have permission for this action`

- IG Business Account が Business Portfolio 所有のため User token だと publish 拒否。
- 発見方法: `/me/accounts` が空 → `pages_show_list` があっても Business 所有 Page は見えないが、直接 `/{page_id}` にアクセスすれば OK。
- 教訓: **Business Portfolio 配下の Page には Page token を派生させて使う**。

### IG `2207076 Media upload has failed`

- URL fetch 方式が Meta 側で失敗 (原因は特定不能、Google CDN の mp4 ですら落ちる)。
- 教訓: **resumable upload が最も確実**。URL 方式は非推奨として温存するだけ。

### `GITHUB_TOKEN` で `gh secret set` が 403

- デフォルト `GITHUB_TOKEN` は repository secrets に書けない。
- 教訓: **secret 書き込みは Fine-grained PAT が必要**。

---

## 動作確認手順

### YouTube 単独テスト

```bash
export YOUTUBE_CLIENT_ID=... YOUTUBE_CLIENT_SECRET=... YOUTUBE_REFRESH_TOKEN=...
node scripts/upload-youtube.mjs --video=output/coffee-YYYYMMDD.mp4
```

### Instagram 単独テスト (GitHub Actions)

```bash
# release asset を指定して試す
gh workflow run test-instagram-upload.yml \
  -f release_tag=vYYYYMMDD \
  -f asset_name=coffee-YYYYMMDD.mp4
```

### Refresh workflow の手動実行

```bash
gh workflow run refresh-instagram-token.yml
gh run list --workflow=refresh-instagram-token.yml --limit=1
```

### フルパイプライン手動実行

```bash
gh workflow run daily-video.yml
# cron 待たずに確認したい時
```

---

## 既知のトレードオフ・未対応事項

1. `post-sns.mjs` の Summary 出力は、認証失敗時も "skipped" と表示するため workflow は緑のまま。本当に失敗した時の検知性が弱い (元から)。`daily-video.yml` の 2026-04-17 以前の run がすべて "success" だったのはこれが原因。次の改善候補。
2. `daily-video.yml` は `GITHUB_TOKEN` で release を作る。release 作成は動作する (contents: write 権限で足りる)。secrets 書き込みではないので PAT 不要。
3. GitHub Release `v20260417` には複数の変種 (`coffee-20260417.mp4`, `-ig.mp4`, `-ig2.mp4`, `-ig3.mp4`) が混在している。次回 cron の release 作成は衝突しない (別日付のタグ) が、掃除するなら `v20260417` の `-ig*` を消してよい。

---

## 本日の変更 PR 一覧

- [#5 Fix SNS auth: YouTube loopback redirect, IG token self-refresh](https://github.com/nannantown/coffee-daily-video/pull/5)
- [#7 Instagram: derive Page Access Token at upload time](https://github.com/nannantown/coffee-daily-video/pull/7)
- [#8 Instagram: resumable upload + yuv420p](https://github.com/nannantown/coffee-daily-video/pull/8)
- [#9 post-sns: pass local path to Instagram (resumable)](https://github.com/nannantown/coffee-daily-video/pull/9)

## 成功の証拠

- YouTube Short: https://youtube.com/shorts/-jcL36FcK0Q (チャンネル `@MindBrewLab`)
- Instagram Reel: `@open_ground_coffee_roasters` の 2026-04-17 投稿 (Media ID `18103968496820650`)

---

## 他セッションがよく聞くであろう質問

**Q. 明日の自動投稿が失敗したらまずどこを見る？**
A. `gh run list --workflow=daily-video.yml --limit=5` → 失敗した run の log。`unauthorized_client` なら YouTube 再認証、`#10` なら Page token 派生失敗 (FACEBOOK_PAGE_ID 確認)、`2207076` なら resumable flow に戻っているか確認、`Session has expired` なら refresh workflow の状態確認。

**Q. IG トークンを手動で取り直すには？**
A. 本ドキュメント「Token 再発行手順」セクション参照。短期トークンを secret に入れて `gh workflow run refresh-instagram-token.yml` で長期化されるのが速い。

**Q. YouTube にログインし直す必要が出たら？**
A. 本ドキュメント「再認証手順」セクション参照。`scripts/auth-youtube.mjs` を使えば loopback redirect で完結する。

**Q. 別の IG アカウントに切り替えたい？**
A. `INSTAGRAM_USER_ID`, `FACEBOOK_PAGE_ID` を差し替え、そのアカウント権限を持つユーザーで User token を取り直す。Meta App (Social Media Manager) は共通で使える。
