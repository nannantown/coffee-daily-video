# 戦略 — Open Ground Coffee

> **2026-09-14 オーナー決定**:「AI系 IG 以外の 5 アカウントはジャンル/型を変えながら試す。コーヒーは販促維持」。
> これに基づき、型を「ニュース解説」から「保存される実用カタログ（今日の一杯レシピカード）」へ切り替えた。
> このファイルの書き換えはオーナー明示指示のみ。毎朝ルーチンは `docs/pdca/YYYY-MM-DD.md` の「戦略更新提案」までに留める。

## ジャンル試行 #1: レシピカード型（「今日の一杯」）

| 項目 | 内容 |
|---|---|
| 試行 # | **#1**（#0 = 2026-04-19〜09-14 の「平日コーヒーニュース + 週末エバーグリーン」） |
| 型 | 毎日 1 本、**豆（自社ラインナップから必ず 1 つ）× 抽出法 × 数値 × 味 × 悩み別のコツ** を 1080x1920 の文字カード 5 枚で完結。**日曜だけ「今週の世界のコーヒーニュース TOP5」** |
| 開始日 | **2026-09-15**（予定）。新型の初回投稿日を Day 1 とする。main 統合がずれた場合は `performance-history.json` で `content.trial = "coffee-trial-1-recipe-card"` が最初に付いた日付に読み替える（`scripts/pdca-summary.mjs` が自動で判定） |
| 判定日 | **2026-09-29**（開始日 + 14 日 = Day 15 の朝ルーチン） |
| 判定窓 | 開始日〜開始日 + 13 日に投稿された動画（14 本） |
| 主指標 | **IG 保存数**（`instagram.saved`）。判定は sns-hub のジャンル実験ルールどおり IG（views 中央値 + 保存合計）と YT（views 中央値）を**別々に**出す |
| 判定基準（初期値） | sns-hub `docs/strategy/genre-experiment.md` (c) に従う。IG: 配信死亡 = views 中央値 < 10 かつ保存合計 < 5 / 切替候補 = 中央値 < 50 かつ保存合計 < 5 / 続行 = それ以外。YT: 配信死亡 < 5 / 切替候補 < 20 / 続行 ≥ 20。n < 7 は判定保留 |
| ベースライン | 試行 #0: IG 80 本で**保存 0**・views 中央値 11（直近 09-01..09-14 は 2.5）、YT views 中央値 0 |
| 仮説 | #0 で相対的に伸びたのは全部「やり方」系（豆を凍らせて挽く / Lance Hedrick の万能 V60）。淹れる時に見返したくなる数値つきレシピにすれば保存が付き、保存 → 再表示 → リーチの順で伸びる。毎回自社豆を使うので、そのままカタログになる |

### 台帳の写し（sns-hub `docs/strategy/genre-experiment.md`）

| アカウント | リポ | 試行 # | ジャンル / 型 | 開始日 | 判定日 |
|---|---|---|---|---|---|
| IG @open_ground_coffee_roasters | coffee-daily-video | #1 | 「今日の一杯」レシピカード型 + 日曜ニュース TOP5 | 2026-09-15（予定） | 2026-09-29 |
| YT @MindBrewLab | coffee-daily-video | #1 | 同上 | 2026-09-15（予定） | 2026-09-29 |

## 売りたいもの

**スペシャリティコーヒー豆の焙煎品**。自前 EC（https://open-ground.co 、2026-09-14 時点は非公開の COMING SOON）から直販。現時点の購入・卸の窓口は Instagram の DM。
カフェ卸も並行して継続（卸経由で知ってもらう入口にも機能）。

## 運用フォーマット: 「今日の一杯」レシピカード

| 曜日 | `format` | 中身 |
|---|---|---|
| 月〜土 | `recipe` | 豆 × 抽出法 × 数値 × 味 × 悩み別のコツ（自社豆のカタログを兼ねる） |
| 日 | `news-top5` | 今週の世界のコーヒーニュース TOP5（1 本ずつ数字つき） |

### カード構成（文字スライド・約 40 秒・60 秒未満厳守）

| # | recipe | news-top5 |
|---|---|---|
| 1 | 今日の一杯: 悩み/効果のフック + 豆 + 数値 6 つ（豆 g / お湯 g / 湯温 / 時間 / 挽き目 / 比率、アイスは比率の代わりに氷） | 表紙: 今週の TOP5 見出し一覧 |
| 2 | 手順: 時刻 × 注ぐ量（スケールの累計 g） | 1〜5 位: 順位・見出し・数字・要約・出典（1 枚ずつ） |
| 3 | 味わい: フレーバー（ラベル準拠）+ 酸味・甘み・コク 5 段階 | |
| 4 | 悩み別のコツ: 酸っぱい時 / 苦い時 / 氷で薄まる時 … → 数字で直す | |
| 5 | 保存の呼びかけ + 販売導線（豆の商品名） | 締め: 平日は今日の一杯 + 販売導線 |

- 1 枚目で数値が全部見える（AI Trend Daily の「数字で並べる」型に寄せる）。表紙フレームがそのまま IG グリッドのサムネになる
- 写真素材は後から足す前提で、まず文字だけ。タイポ: 本文 30px 以上 / ラベルは solid pill（不透明の塗り + 白文字、色は枠線で持つ）/ 線・バーの色とテキストの色を一致させない / フォントは既存の Noto Sans CJK JP
- ナレーションは補助（カードだけで完結するので字幕は出さない）。合計 230 文字目安、上限 260

### 豆マスタ（`data/coffee-lineup.json`）

EC の商品テーブルで公開中（is_active）の 5 種。`status: candidate` はオーナー確認待ち → PR で `confirmed` にする。ルーチンは必ずここから選び、`scripts/validate-content.mjs` がマスタ外の豆を弾く。

| id | 商品名 | 焙煎 | ラベル | 標準レシピ（ルーチン失敗時の代替） |
|---|---|---|---|---|
| `burundi-mabanza` | ブルンジ マバンザ ウォッシュド | 浅煎り | RED FRUITS & CARAMEL | V60 ホット 15g / 240g / 92℃ / 2:45 |
| `rwanda-humure` | ルワンダ フムレ ウォッシュド | 浅煎り | CHESTNUT & TEA | フレンチプレス 15g / 250g / 94℃ / 4:00 |
| `ethiopia-yirgacheffe-kochere` | エチオピア イルガチェフェ コチャレ ウォッシュド | 浅煎り | CITRUS & FLORAL | V60 急冷アイス 20g / 150g + 氷 100g / 93℃ / 2:15 |
| `china-dehong-east-fermentation` | 中国 デーホン イーストファーメンテーション ハニー | 浅煎り | LYCHEE & OOLONG TEA | エアロプレス 15g / 220g / 90℃ / 2:00 |
| `decaf-nicaragua-gold-mountain` | デカフェ ニカラグア ゴールドマウンテン ナチュラル | 中煎り | CANE SUGAR & TOAST | 水出し 50g / 500g / 10 時間 |

ルーチンが失敗した朝（JSON が無い / 日付が古い / 検証 NG）は、日付で決まる豆の標準レシピで自動投稿する（型は崩さない）。

### 販売導線（固定）

最後のカードと、キャプション末尾に毎回同じ導線を入れる。文言は `coffee-lineup.json` の `shop.ctaMode` 1 か所で切り替える。

| `ctaMode` | 使う時 | カード / キャプション末尾 |
|---|---|---|
| `dm`（**現在**） | EC 非公開・IG プロフィールにリンクなし（bio は「豆の購入や卸しはDMで」） | 「ご購入・卸のご相談は DM へ」/「ご購入・卸のご相談は Instagram の DM（@open_ground_coffee_roasters）からお気軽にどうぞ。」 |
| `profile-link` | IG プロフィールにショップリンクを置いた後 | 「ご購入はプロフィールのリンクから」 |
| `ec-url` | EC 公開後（`ecPublic: true` のときだけ有効） | 「ご購入はこちら → https://open-ground.co」 |

動画の中で URL は読み上げない（遷移率より記憶性）。

## ペルソナ（優先順）

### Primary: 家で淹れる趣味層
- 既にコーヒー器具（ドリッパー、ミル）を所有
- 1 袋 ¥1,500〜¥3,000 に抵抗がない
- 産地・精製方法・ロースト日などの情報で買う豆を決める
- **失敗した淹れ方のリカバリに興味がある**（→ 悩み別のコツ）
- **この層を取れなければ事業成立しない**

### Secondary: 開業したての小規模カフェ店主
- 卸先として直接的な収益
- 1 店舗が決まると月5〜15kg の安定需要
- SNS は広告ではなく「焙煎所を知ってもらう信頼シグナル」として機能（→ 抽出レシピの具体性が信頼になる）

### Tertiary: ギフト需要
- おしゃれなビン/パッケージが意思決定に効く
- 父の日、誕生日、開業祝いなど季節キャンペーンで拾う

## 差別化ポイント

1. **焙煎した本人が出す数値つきレシピ** — 豆ごとの湯温・挽き目・比率は焙煎所にしか出せない一次情報
2. **毎回、実際に買える自社豆で淹れる** — レシピがそのまま商品カタログになる
3. **ビン・パッケージの意匠** — 贈答にそのまま使える

## PDCA で比べる軸

毎朝ルーチンは `node scripts/pdca-summary.mjs` の出力（IG 保存数が主指標）を `docs/pdca/YYYY-MM-DD.md` の冒頭に貼り、次の軸で保存の付き方を比べる。値は `record-upload.mjs` が `performance-history.json` の `content` に記録する。

| 軸 | 値 | `content` のキー |
|---|---|---|
| 豆 | 豆マスタの id | `beanId` / `beanName` |
| 抽出法 | V60 / カリタウェーブ / ORIGAMI / ケメックス / クレバー / フレンチプレス / エアロプレス / 水出し / マキネッタ | `method` |
| 切り口 | 悩み起点 / 季節 / 豆の個性 / 器具 / 名レシピ応用 | `angle` |
| 温度帯 | ホット / アイス | `scene` |
| 悩み | コツカードの「〜時」 | `tipProblems` |
| 型 | レシピ / ニュース TOP5 / 代替（標準レシピ） | `format` / `fallback` |

ローテーション: 同じ豆・同じ抽出法を 2 日連続で使わない。7 日で全ラインナップを 1 回以上。暑い時期のアイスは週 2 回まで。

## 日曜ニュース TOP5 の探索方針

### 英語優先原則

**英語ソースを先に見る**。日本語メディアは英語を翻訳する形で 1〜3 日遅れる。先に英語で拾い、日本の家で淹れる人・豆を買う人に効く順（価格・供給・産地・トレンド）で 5 本に絞る。

### 推奨ソース（シード）

**英語（優先）**: Perfect Daily Grind / Daily Coffee News (Roast Magazine) / SCA News / Bloomberg・Reuters（Arabica Futures, Coffee C）/ World Coffee Research / Global Coffee Report / World Coffee Portal / Reddit r/Coffee, r/roasting

**日本語（バックアップ）**: SCAJ 公式 / 業界誌（カフェ＆レストラン、Coffee magazine JP）/ X の日本語バリスタ界隈

### Discovery Methods（`discovery.method`）

| タグ | 説明 |
|---|---|
| `news-en` | 英語の業界メディア・ニュースサイト |
| `news-ja` | 日本語の業界メディア |
| `market-data` | 商品市況、為替、指標データ |
| `official-src` | 産地機関、協会、WCR 等の公式発信 |
| `social-en` | Reddit / X（英語）のコミュニティ話題 |
| `social-ja` | X 日本語バリスタ・焙煎士界隈 |
| `trends` | Google Trends, X Trending |
| `expert-blog` | 業界有名人の個人発信・ブログ |

## NG パターン

| NG | 理由 |
|---|---|
| **数値が物理的に合わないレシピ**（最後の注湯量 ≠ お湯の量、常識外の比率、アイスなのに氷の量なし） | 保存される実用性の根幹。`validate-content.mjs` が機械チェック |
| **ラインナップ外の豆を使う** | 販促が目的。マスタにない豆は検証で弾かれ、標準レシピに差し替わる |
| **ラベル表記と矛盾するフレーバー** | 買った人の期待を裏切る |
| 出典のない「有名レシピ」 | 下敷きにしたら `recipe.sources` に URL を残す |
| 健康効果・医療的な断定、根拠のない最上級 | 信用毀損 |
| 「コーヒーあるある」「コーヒー雑学」 | 通りすがりが集まるが、豆を買う層ではない |
| 「モーニングルーティン」系 | 差別化不能、競合だらけ |
| 「インスタント vs ドリップ」的な初心者解説 | ターゲット層には幼稚に映る |
| **非公開 EC への URL 誘導** | COMING SOON の画面で止まり失望させる。`ecPublic: true` になるまでは DM 導線 |
| 1 週間以上前のニュース（日曜 TOP5） | 鮮度が命。`freshness_hours > 168` は NG |
| 出典不明ニュース（日曜 TOP5） | 信用毀損。項目ごとに URL を必ず記録 |

## ファネル

```
SNS 視聴（今日の一杯レシピ）
  ↓ 保存（淹れる時に見返す）→ 保存が再表示・リーチを呼ぶ
自社豆の名前と味を覚える（毎回ちがう豆 × ちがう淹れ方）
  ↓ 最後のカード / キャプション末尾の販売導線
DM（現在）→ EC（公開後）
  ↓ 初回購入（「あのレシピの豆」）
定期便 or 2 回目購入
  ↓ リピート
熱心なファン化（淹れた写真の UGC、紹介）
```

## 目標（初期ドラフト）

| 期限 | 指標 | 数値 |
|---|---|---|
| 試行 #1 判定日（2026-09-29） | IG 保存合計（判定窓 14 本） | ≥ 5（ジャンル実験ルールの「続行」ライン） |
| 3 ヶ月後（2026-07） | 合算フォロワー | 1,000 |
| 3 ヶ月後 | EC 初月の注文数 | 20 件 |
| 6 ヶ月後（2026-10） | 月商 | ¥300,000 |
| 6 ヶ月後 | カフェ卸先 | +2 店舗 |
| 1 年後（2027-04） | 月商 | ¥800,000 |
| 1 年後 | 定期便契約数 | 50 件 |

※ 単価 ¥2,500 想定。EC 完成時点で再計算。

## KPI ダッシュボード

- **主指標: IG 保存数 / 動画**（保存率 = 保存 ÷ reach）
- IG views 中央値・shares・reach（`performance-history.json` の `instagram.*`）
- 軸別（抽出法 / 豆 / 切り口）の IG 保存平均（`scripts/pdca-summary.mjs`）
- DM での購入・卸の問い合わせ数（手動記録）
- EC 公開後: EC 遷移数（UTM）/ 注文件数 / 平均注文単価 / 定期便契約率
- 参考: YT views（IG と合算しない）

### performance-history.json の指標

| キー | 取得元 | 更新 |
|---|---|---|
| `stats.views` / `likes` / `comments` | YouTube Data API v3 | `fetch-stats.mjs`（直近 14 日） |
| `instagram.mediaId` | 投稿時に `upload-instagram.mjs` → `record-upload.mjs` が記録。無い回は `fetch-stats.mjs` が IG 投稿一覧と JST 投稿日で突き合わせて復元 | 投稿時 / 初回取得時 |
| `instagram.views` / `reach` / `likes` / `comments` / `shares` / `saved` | Instagram Graph API `/{ig-media-id}/insights`（`plays` は廃止済みのため `views` を使用） | `fetch-stats.mjs`（直近 14 日 + 未取得の回） |
| `content` | `record-upload.mjs`（`format` / `trial` / `fallback` / `beanId` / `method` / `angle` / `scene` / `tipProblems`、ニュースは `headlines`）。旧型ニュースの回は無し | 投稿時 |

IG insights は最大 48 時間遅れる。前日・前々日の IG 値は暫定として比較から外す（`pdca-summary.mjs` が「（暫定）」を付ける）。手動で更新だけしたいときは `gh workflow run fetch-stats.yml`（動画生成・投稿はしない）。

## データスキーマ（`data/enriched-coffee-news.json`）

ファイル名は横断 PDCA ルーチンと `record-upload.mjs` が読むので据え置き、`format` で型を切り替える。フィールドと文字数上限の正本は `scripts/content-format.mjs`、ルーチン向けの書き方は [routine-prompt.md](routine-prompt.md)、見本は `data/samples/`。

```json
{
  "date": "2026-09-15",
  "format": "recipe",
  "trial": "coffee-trial-1-recipe-card",
  "recipe": {
    "beanId": "ethiopia-yirgacheffe-kochere",
    "method": "v60",
    "scene": "hot",
    "angle": "trouble",
    "hook": "浅煎りが酸っぱい人のV60",
    "numbers": { "dose_g": 15, "water_g": 225, "temp_c": 93, "grind": "中細挽き", "time": "2:30" },
    "steps": [{ "time": "0:00", "action": "蒸らし", "pour_to_g": 45 }],
    "taste": { "notes": ["レモン"], "summary": "酸味が甘さに変わる一杯", "acidity": 3, "sweetness": 4, "body": 2 },
    "tips": [{ "problem": "酸っぱい時", "fix": "湯温を2℃上げて95℃に" }],
    "narration": { "title": "…", "numbers": "…", "steps": "…", "taste": "…", "tips": "…", "cta": "…" }
  }
}
```

`format` の無い JSON（旧型ニュース）も当日付なら従来のニュース解説として描画される（切り戻し用）。

## 検証とロールバック

- 検証（投稿しない）: `gh workflow run daily-video.yml --ref <branch> -f sample=recipe`（`news-top5` / `fallback` / `today` も可）。main 以外の ref は常に検証モードで、動画・カバー・キャプション・カード画像を artifact に出す。ローカルは `DRY_RUN=true node scripts/pipeline.mjs --content=data/samples/recipe.sample.json`
- 試行を打ち切る場合: ルーチン指示（`docs/routine-prompt.md`）を旧型の JSON を書く内容に戻せば、パイプラインは `format` の無い JSON を旧ニュース解説として描画する

## TBD（オーナー確認）

- [ ] 豆マスタの確定（5 種が今売っている豆と一致しているか、`candidate` → `confirmed`、紹介しない豆は `retired`）
- [ ] 販売導線の文言（当面 DM 導線でよいか）
- [ ] 判定日 2026-09-29 の判定後、次の型（続行 / 切替）の決定
- [x] EC サイト URL: https://open-ground.co（非公開。公開したら `ecPublic: true` + `ctaMode: "ec-url"`）
- [ ] 送料設定 / 定期便の有無と割引率 / ギフト対応 / 卸価格表
