# 文字の大きさの決まり（タイプスケール）と、表紙の新しい方向 3 案

作成 2026-09-26。対象は 1080×1920 の縦動画（IG リール / YT ショート）の表紙と中のスライド。
前提: **ゴシック体だけ**（明朝は使わない）・無料フォント（Noto Sans JP）・ジャンプ率を今より小さく・本文は最低 40px。

## 1. 単位

- **すべて px（1080×1920 のキャンバス上の px）** で書く。リポの約束「本文 30pt 以上」は **40px** として扱う（`src/cards/theme.ts` の `TYPE.bodyMin = 40`）。
- スマホで見たときの大きさは、幅 390pt の iPhone を基準に **px × 0.361 = pt** で出す（1080px → 390pt）。

## 2. 決めた比率と大きさ

**大見出し : 中見出し : 本文 : 補助 = 2.67 : 1.33 : 1 : 0.83（= 128 : 64 : 48 : 40 px）**

サイズは 4 つだけ。40 / 48 / 64 / 128。今の案（250 : 92 : 40 ≒ 6 : 2.3 : 1）より、大見出しと本文の差を半分以下にした。

| 役割 | px | 太さ（Noto Sans JP） | 行の高さ | 字間 | スマホ上 | 1 行の最大字数（920px / 840px） |
|---|---|---|---|---|---|---|
| 表紙の大きな言葉（「湯温」） | 128 | 700 Bold | 1.15 | `palt` + 0 | 46pt | 7 / 6 字（**使うのは 2〜4 字**） |
| 表紙の問いかけ（「を上げると？」） | 64 | 500 Medium | 1.4 | `palt` + 0.02em | 23pt | 14 / 12 字 |
| 表紙の味の一行（「苦味とコクが増える」） | 48 | 700 Bold | 1.5 | 0.04em | 17pt | 18 / 16 字 |
| スライドの見出し | 64 | 700 Bold | 1.4 | `palt` + 0.02em | 23pt | 14 / 12 字 |
| スライドの本文（理由・上げると→…） | 48 | 500 Medium | 1.6 | 0.04em | 17pt | 18 / 16 字（**1 枚 2 行まで**） |
| 補助（図のラベル・回の番号） | 40 | 500 Medium | 1.5 | 0.04em | 14pt | 22 / 20 字 |

- 900 Black は使わない（太すぎて「昔のテロップ」に見える。大見出しも 700 で止める）。数字は `font-variant-numeric: tabular-nums`。
- 字数の計算: 行幅 ÷（文字サイズ ×（1 + 字間））の切り捨て。
- **920px** = 左右 80px の余白を引いた幅（x 80〜1000。今のリポの決まり）。**840px** = 右のアクション列（ハート等、x≈930〜1060）に完全にかからない幅（x 80〜920）。画面の下半分（y 900 より下）に置く文字は 840px を使う。
- 縦の置き場: 上 270px・下 672px は IG の UI がかぶる（Meta の安全域 上 14% / 下 35%）。表紙の文字は y 300〜1240 に収める。

## 3. プロフィール一覧（グリッド）での見え方の確認

- IG のプロフィール一覧は 3:4 の縦長表示（2025 年に 1:1 から変更）。1080×1920 の表紙は中央の 1080×1440（y 240〜1680）が見える。
- 1 マスの幅は約 129pt（390pt ÷ 3 − 隙間）。縮小率は 129 ÷ 1080 = **0.119**（幅 430pt の大きい機種なら 0.132）。
- **大見出し 128px → 一覧では 15.3pt（大きい機種で 16.9pt）**。iOS の本文の標準 17pt とほぼ同じで、**読める**。
- 問いかけの 64px は 7.6pt、味の一行の 48px は 5.7pt になり、一覧では読めない。**一覧で伝わるのは大きな言葉と絵だけ**という前提で作る（問いかけと味の一行は動画を開いてから読む）。
- 128px より小さくすると一覧で 15pt を切るので、大見出しはこれより小さくしない。ジャンプ率の下限を決めているのはこの条件。

## 4. 根拠

- ジャンプ率の目安: 見出しが本文の 2 倍 = 標準、3.75 倍 = かなり強い、黄金比 1.618 が出発点（sevendesign.biz、2026-09-26 取得）。ジャンプ率が高いと躍動的・低いと落ち着き・信頼（bindup.jp、2026-09-26 取得。数値なし）。
- Apple HIG（標準の文字サイズ）: Large Title 34pt / Title 1 28 / Title 2 22 / Body 17 → **34 ÷ 17 = 2.0**。今回の 46 / 23 / 17 / 14pt は、見出し 23pt ≒ Title 2、本文 17pt = Body に合わせた。
- Material 3 の type scale token: display-large 57 / headline-large 32 / title-large 22 / body-large 16 / body-medium 14 → display ÷ body = **3.56**、headline ÷ body = 2.0。大見出しの 2.67 はこの間。
- W3C 日本語組版処理の要件（jlreq）: 横組の 1 行は最大 40 字程度がよい。和文は欧文より行間を広く取る（例: 9pt の文字に行間 8pt / 6pt = 行の高さ 1.89 / 1.67）。動画は 1〜2 行の短い句なので本文 1.6 にした。
- Meta の安全域（上 14% / 左右 6% / 下 35%）: behaviour.digital ほかの解説記事で確認（2026-09-26 取得）。Meta の公式ヘルプ本体は【資料取得できず】（中身が表示されなかった）。
- IG の一覧が 3:4 になった件: sharecoto.co.jp（2025-03-04 の記事、2026-09-26 取得）。
- 表紙の字数の目安: タイトル 10 字程度・色は 3 色まで・文字と余白 7:3（sns-sakiyomi.com、2026-09-26 取得）。

URL（すべて 2026-09-26 取得）:
https://www.sevendesign.biz/blog/web-design-jumprate/ ・ https://bindup.jp/camp/design/32583 ・ https://developer.apple.com/design/human-interface-guidelines/typography ・ https://github.com/material-foundation/material-tokens （json ブランチ `json/typescale.json`）・ https://www.w3.org/TR/jlreq/ ・ https://behaviour.digital/post/meta-reels-safe-zone-14-top-35-bottom-6-sides-the-2026-official-guide ・ https://www.facebook.com/business/help/980593475366490/ ・ https://www.sharecoto.co.jp/instagramlab/profile-grid ・ https://sns-sakiyomi.com/blog/function/instagram-front-cover/

## 5. モダンな SNS デザインの実例と共通点

**Instagram は未ログインで見られず【資料取得できず】**（onyxcoffeelab / kurasu.kyoto で試してログイン画面になった）。代わりに、同じアカウントや同じ業種の YouTube ショートの表紙画像（i.ytimg.com の縦 1080×1920）を取って目で測った。px は 1080 幅に換算した目安。

| アカウント（投稿日） | 絵 | 文字 | 比率の目安 |
|---|---|---|---|
| James Hoffmann ショート `4S87o1l5BL8`（2026-06-02）・`tJf6T4JIICA`（2026-08-27） | 本人と台所の写真、白っぽい背景 | 字幕だけ。白地に黒の帯・欧文サンセリフ 約 95px | 1 : 1（1 サイズ） |
| James Hoffmann 横長サムネ `Iy8m7AbZVm0`（2026-09-04） | 白黒写真・細い青枠 | 縦長の欧文 1 行だけ | 1 サイズ |
| Kurasu コーヒートーク `1Ie39IwRWQ0`（2025-05-30） | 機械の写真、温かい色の壁 | 白ゴシック 約 65px、要所だけオレンジ | 1 : 1、強調は色だけ |
| Fellow `NbaTKXSHJ6A`（2026-09-24） | 生成りの紙・細い線画に青 1 色 | 小さめのロゴ・商品名 約 85px・説明 約 25px | 余白が多い |
| Fellow `tElHpQLc-Gc`（2026-09-22） | ベージュ背景に黒いグラインダー | 白の太字 約 70px、左上 | 1 サイズ |
| Lance Hedrick `XkBKWBCiVxc`（2026-09-21） | 本人の写真が主役 | 下の小さなラベル 約 45〜70px | ラベルだけ |
| Morgan Eckroth `KVRIeibMhxY`（2026-08-11） | 手元の接写 | 字幕 約 40px | ほぼ文字なし |
| クラシル `KvSPVZkMROM`（2026-09-21） | 写真 2 枚を縦に | 白黄のゴシック 約 80px / 下の題 約 110px | 約 1.4 : 1 |
| 川野優馬（LIGHT UP COFFEE）`z4CS8JUkh44`（2022-11-03） | 暗めの写真で注いでいる手元 | 白ゴシック・黒帯 2 行 | 1 : 1 |
| **古く見える比較用**: Tomoya's Coffee Juku `NLSkw-AAejc`（2021）・Kenken Coffee `DSt-a0X-AKs` `2Hfjh9-gJPY`・畠山大輝 `5A82xHbt9B4`（2020） | 写真の上に文字 | 太いフチ・グラデーション・赤黄の塗り | **3.6 : 2.3 : 1**（Tomoya） |

**共通点（今のもの）**
- 色: 生成り・ベージュ・木・黒の製品など**落ち着いた中間色が土台で、目立たせる色は 1 色だけ**。原色の塗りはない。
- 余白: 画面の半分以上が写真か何もない面。**文字が占めるのは 1〜2 割**。
- 絵: 実写（柔らかい自然光）か、細い線画。光る・フチ取り・立体文字はない。
- 書体: サンセリフ / ゴシック 1 種類。太さで差をつけ、**サイズは 1〜2 種類**。
- 文字の量: 表紙の文字は 1 行か 2 行。**ジャンプ率はほぼ 1.0〜1.4**。2.5 を超えるのは 2020〜22 年の「古く見える」側だけ。
- 一覧のまとまり: 文字の位置・色調・書体を毎回同じにして、**写っているもの（主題）だけを回ごとに変える**。
- 古く見える側の特徴: 太いフチ、グラデーション文字、赤と黄、1 枚に 3〜4 サイズ、ジャンプ率 3 以上。今回の却下理由（ステッカー風のフチ・原色・古臭い）と一致する。

## 6. 表紙の 3 案（サイズはすべて §2 の 128 / 64 / 48 / 40）

### 案 A「ラボノート」— 生成りの紙と細い線画
- 色: 背景 `#F3F0EA`・文字 `#22201C`・補助 `#6B655C`・罫線 `#D6D0C4`。**回ごとの色は 8 本柱に 1 色ずつ**（湯温 `#B5563A` / 挽き目 `#7A6A58` / 比率 `#4F6D7A` / 抽出時間 `#8A7F3F` / 注ぎ方 `#3F6B5A` / 器具 `#5B5570` / 味の直し方 `#A0584F` / 器具なし `#6F7B4A`）。1 枚に使うのはその 1 色だけ。
- 文字: 左上に「No.012 ・ 抽出メモ」40px/500。その下に「湯温」128px/700、続けて「を上げると？」64px/500。細い罫線 2px を 1 本引いて、味の一行 48px/700 を柱の色で。
- 絵: 下半分に 2〜3px の線画（ケトルと温度計）と、上下の矢印の小さな図。塗りは柱の色を 15% に薄めたものだけ。
- 一覧での見分け: 柱の色・線画の主題・回の番号。
- 参考: Fellow `NbaTKXSHJ6A`、James Hoffmann 2026 年の表紙の抑え方、Kurasu `1Ie39IwRWQ0` の「強調は色だけ」。

### 案 B「自然光の写真」— 写真が主役、文字は小さく静かに
- 色: 写真の色（エスプレッソ `#2B211B`・クレマ `#C89B6D`・オーツ `#EFE6DA`）に、文字は白 `#FFFFFF`、味の一行だけアンバー `#E3B37A`。上から下へ `rgba(20,16,12,0.45)`→透明 の弱い影で文字を読ませる（帯やフチは使わない）。
- 文字: 左上にまとめる。「湯温」128px/700 白、「を上げると？」64px/500 白、味の一行 48px/700 アンバー。
- 絵: 全面の接写写真。その回の要素を 1 つだけ写す（湯気の立つ注ぎ口、挽いた粉の粒など）。毎回同じ色調補正をかける。
- 一覧での見分け: 文字の位置と色調は固定、写真の主題と構図が回ごとに変わる。
- 参考: Kurasu `1Ie39IwRWQ0`、Fellow `tElHpQLc-Gc`、川野優馬 `z4CS8JUkh44`。

### 案 C「色の面と静物」— くすんだ単色の背景と、同じ色のやわらかい立体
- 色: 柱ごとに背景と文字を同じ色味の濃淡で組む（湯温 背景 `#D9B8A3` / 文字 `#5A3A2C`、挽き目 `#CFC6B3` / `#4A4336`、比率 `#B9C4C9` / `#34454D`、注ぎ方 `#B8C6B6` / `#33483A` など）。真っ黒と真っ白は使わない。
- 文字: 中央揃え。「湯温」128px/700、「を上げると？」64px/500、味の一行 48px/700。すべて同じ色味の濃い色。
- 絵: 下の中央に、つやのないクレイ素材の立体を 1 つ（ケトル、ドリッパーなど）。背景と同じ色味で、柔らかい影を落とす。光らせない。
- 一覧での見分け: 背景の色が柱ごとに変わるので、一覧がくすんだ色の並びになる。物の形も回ごとに違う。
- 参考: Fellow `tElHpQLc-Gc`（ベージュの面に製品 1 つ）・Fellow `NbaTKXSHJ6A`（色の名前で見せる）。ほかは【資料取得できず】（IG が見られなかった）。

## 7. 画像生成用のプロンプト（英語、1080×1920 の表紙）

生成 AI は日本語を崩しやすい。**本番では文字を Remotion で重ね、プロンプトは絵の雰囲気を確認するために使う**のが確実。

**A — Lab Note**
> Vertical 1080x1920 Instagram Reels cover, modern minimal editorial design. Warm off-white paper background #F3F0EA, generous whitespace. Top-left small label "No.012 ・ 抽出メモ" in grey #6B655C. Below it the large Japanese word 「湯温」 in bold Noto Sans JP, dark ink #22201C, about 12% of the canvas width per character, immediately followed by 「を上げると？」 in medium weight at half that size. A thin 2px hairline rule, then one line 「苦味とコクが増える」 in terracotta #B5563A. Lower half: delicate 2-3px single-colour line drawing of a gooseneck kettle with a thermometer and a small up-arrow diagram, terracotta 15% tint fills only. Gothic sans-serif only, no serif, no outlines, no stickers, no neon, no gradients, flat but refined, lots of negative space.

**B — Natural Light Photo**
> Vertical 1080x1920 Instagram Reels cover. Full-bleed macro photograph of hot water pouring from a gooseneck kettle spout with soft steam, warm morning window light, shallow depth of field, muted espresso brown #2B211B, crema #C89B6D and oat #EFE6DA tones, film-like natural grade. Subtle dark gradient at the top only (no bar). Top-left text block: large Japanese word 「湯温」 in bold white Noto Sans JP, followed by 「を上げると？」 in white medium weight at half size, then 「苦味とコクが増える」 in soft amber #E3B37A. Text occupies under 20% of the frame, gothic sans-serif only, no outlines, no drop-shadow stickers, no neon, calm and premium like a specialty coffee roaster's feed.

**C — Tonal Still Life**
> Vertical 1080x1920 Instagram Reels cover. Solid muted clay-colour background #D9B8A3. Centred at the lower middle, one soft 3D render of a matte clay-material gooseneck kettle in the same clay hue, soft diffused studio light and a gentle contact shadow, no gloss, no glow. Upper third, centred text in deep brown #5A3A2C: large Japanese word 「湯温」 in bold Noto Sans JP, below it 「を上げると？」 in medium weight at half size, then 「苦味とコクが増える」 smaller in bold. Monochromatic tonal palette, no pure black or white, gothic sans-serif only, no outlines, no primary colours, no neon, minimal and modern, lots of breathing room.
