# Nano Banana Pro Triptych生成 - Geminiへの質問

## 背景

現在、FUSIONモードではImagen 3.0を使用して3:4の単一ビュー（フロント）を生成しています。
次のステップとして、**Nano Banana Pro**を使用した**16:9ワイド画像**での**トリプティック生成**（Front/Side/Back を1枚の画像に同時生成）を実装したいと考えています。

### 現在の実装
- **モデル**: Imagen 3.0
- **アスペクト比**: 3:4 (vertical)
- **生成方法**: フロントビュー1枚 → 別途SIDE/BACKをバリアント生成
- **問題点**: 3回の生成が必要、一貫性が完全ではない

### 目標
- **モデル**: Nano Banana Pro
- **アスペクト比**: 16:9 (wide)
- **生成方法**: 1回の生成でFront/Side/Backを含むトリプティック画像
- **メリット**: Single-Shot Consistency（100% Identity Preservation）

---

## Geminiへの質問

### 1. Nano Banana Pro の基本仕様

**Q1-1**: Nano Banana Proは16:9のワイド画像生成に対応していますか？
- 対応している場合、推奨される解像度は？（例: 1920x1080, 2560x1440等）
- aspectRatio パラメータの指定方法は？

**Q1-2**: Nano Banana Proの生成速度とImagen 3.0との比較を教えてください
- 平均的な生成時間は？
- Imagen 3.0より高速ですか？

**Q1-3**: Nano Banana Proの料金体系は？
- Imagen 3.0と比較して単価は？
- 16:9生成の追加コストは？

---

### 2. トリプティック生成のプロンプト設計

**Q2-1**: 1枚の16:9画像内に3つのビュー（Front/Side/Back）を配置するプロンプトの書き方は？

現在考えている例:
```
FASHION EDITORIAL, 16:9 horizontal composition, product-forward photography.

CRITICAL REQUIREMENT: Generate a triptych showing three views of the SAME GARMENT:
- LEFT PANEL (1/3): Full-body front view, model facing camera
- CENTER PANEL (1/3): Side profile view, model rotated 90° clockwise
- RIGHT PANEL (1/3): Back view, model rotated 180°

All three views MUST show the IDENTICAL garment with:
- Same colors: {palette_hex}
- Same materials: {materials}
- Same silhouette: {silhouette}
- Same details: {invariant_details}

The model should be the same person across all three panels.
Each panel shows only the camera angle change, NOT different clothes.

GARMENT IDENTITY:
Type: {garment_type}
Silhouette: {silhouette}
...
```

このアプローチは有効ですか？改善点はありますか？

**Q2-2**: 3つのビューを均等に分割するため、プロンプトに追加すべき指示は？
- "Equal width panels"
- "Triptych layout with clear panel separation"
- その他の推奨表現は？

**Q2-3**: 各ビューで同一のモデル・同一の衣服を保証するための重要なキーワードは？
- "SAME GARMENT"
- "IDENTICAL OUTFIT"
- "Only camera angle changes"
- その他？

---

### 3. 画像分割ロジック

**Q3-1**: 生成された16:9画像を3分割する際、どの分割方法が推奨されますか？

オプション:
1. **単純3分割**: 画像を左・中央・右に均等分割（1920pxなら640px x 3）
2. **マージン考慮**: 各パネルの間にマージンがある場合、どう検出するか？
3. **AI検出**: 画像内のパネル境界をAI（Vision API等）で検出？

**Q3-2**: 分割後の各ビュー画像のアスペクト比は？
- 16:9 ÷ 3 = 16:27 (≈ 0.59:1) という非標準的な縦長になりますが問題ないですか？
- 3:4 (0.75:1) に近づけるために、どのようにクロップすべきですか？

**Q3-3**: React Native (Expo)での画像分割実装方法は？
- `expo-image-manipulator`を使用してクロップ？
- サーバー側で分割してから返す方が良い？

実装例イメージ:
```typescript
import * as ImageManipulator from 'expo-image-manipulator';

async function splitTriptych(imageUri: string) {
  const imageInfo = await ImageManipulator.manipulateAsync(imageUri);
  const width = imageInfo.width;
  const height = imageInfo.height;
  const panelWidth = width / 3;

  const frontView = await ImageManipulator.manipulateAsync(imageUri, [
    { crop: { originX: 0, originY: 0, width: panelWidth, height } }
  ]);

  const sideView = await ImageManipulator.manipulateAsync(imageUri, [
    { crop: { originX: panelWidth, originY: 0, width: panelWidth, height } }
  ]);

  const backView = await ImageManipulator.manipulateAsync(imageUri, [
    { crop: { originX: panelWidth * 2, originY: 0, width: panelWidth, height } }
  ]);

  return { frontView, sideView, backView };
}
```

このアプローチは適切ですか？

---

### 4. API実装詳細

**Q4-1**: Nano Banana ProのAPI呼び出し方法は？
- Imagen 3.0と同じVertex AI経由ですか？
- モデル名は？（例: `imagegeneration@006` → `nanoBananaPro@001`のような形式？）

**Q4-2**: 16:9生成時のパラメータ設定は？

現在のImagen 3.0の設定:
```typescript
const request = {
  instances: [{
    prompt: buildPrompt(),
  }],
  parameters: {
    sampleCount: 1,
    aspectRatio: "3:4",
    negativePrompt: buildNegativePrompt(),
    seed: baseSeed,
    guidanceScale: 40,
  }
};
```

Nano Banana Proでの変更点:
```typescript
const request = {
  instances: [{
    prompt: buildTriptychPrompt(),
  }],
  parameters: {
    sampleCount: 1,
    aspectRatio: "16:9", // ← これで良い？
    negativePrompt: buildNegativePrompt(),
    seed: baseSeed,
    guidanceScale: 40, // ← Nano Banana Proでも同じ値で良い？
  }
};
```

**Q4-3**: Nano Banana Proの`guidanceScale`の推奨値は？
- Imagen 3.0では40を使用していますが、Nano Banana Proでも同じですか？
- トリプティック生成では異なる値が推奨されますか？

---

### 5. 一貫性保証

**Q5-1**: 1枚の画像内で3ビューを生成する場合、Imagen 3.0の個別生成と比較して一貫性は本当に向上しますか？
- 理論的根拠は？
- 実際のユースケースでの検証結果はありますか？

**Q5-2**: シード値の扱いは？
- 1つのシード値で3ビュー全体を制御できますか？
- それとも各ビューごとに異なるシードを指定する必要がありますか？

**Q5-3**: モデルの顔・体型・肌の色の一貫性を最大化するための追加の工夫は？
- プロンプトに特定のモデル属性を明示する？（例: "Asian female in her 20s"）
- demographic情報（`jp_f_20s`等）をどう反映すべきですか？

---

### 6. エラーハンドリング

**Q6-1**: トリプティック生成が失敗した場合（3ビューが正しく配置されなかった場合）、どう検出しますか？
- Vision APIで各パネルが存在するか確認？
- ユーザーフィードバックに依存？

**Q6-2**: 生成された画像が期待通りでない場合のフォールバック戦略は？
- 従来のImagen 3.0個別生成に自動フォールバック？
- 再生成を促す？

---

### 7. UI/UX設計

**Q7-1**: ユーザーへの表示方法は？

現在の案:
1. **メイン表示**: フロントビューのみを大きく表示
2. **カルーセル**: スワイプでSide/Backビューに切り替え
3. **サムネイル**: 画面下部に3つのサムネイルを並べて表示

どの方式が最も効果的ですか？

**Q7-2**: 生成中のローディング表示は？
- "Generating triptych..." のようなメッセージ？
- プログレスバーは不要？（1回の生成なので）

---

### 8. データベース設計

**Q8-1**: トリプティック画像の保存方法は？

オプション:
1. **元画像を保存**: 16:9のトリプティック全体をR2に保存
2. **分割後を保存**: Front/Side/Back を個別にR2に保存
3. **両方保存**: 元画像 + 分割後の3枚を保存

どれが推奨されますか？

**Q8-2**: `generation_history`テーブルへの追加カラムは必要ですか？

現在の構造:
```sql
generation_history {
  id UUID,
  image_url TEXT,
  image_path TEXT,
  variants JSONB -- [{ type: 'side', r2_url: '...', ... }]
}
```

トリプティックの場合:
```sql
generation_history {
  id UUID,
  image_url TEXT,         -- フロントビューURL
  image_path TEXT,
  triptych_url TEXT,      -- 元の16:9画像URL（NEW）
  triptych_path TEXT,     -- 元の16:9画像パス（NEW）
  variants JSONB          -- 分割後のside/back URL
}
```

この設計で良いですか？

---

### 9. パフォーマンス

**Q9-1**: 16:9画像の生成時間は3:4と比較してどのくらい変わりますか？
- ピクセル数: 3:4 (1024x1365) ≈ 1.4M vs 16:9 (1920x1080) ≈ 2.1M
- 約1.5倍のピクセル数ですが、生成時間も1.5倍になりますか？

**Q9-2**: Nano Banana Proでのタイムアウト設定は？
- Vercel Proで最大300秒ですが、16:9生成でも十分ですか？
- SSE実装は引き続き必要ですか？

---

### 10. フォールバックプラン

**Q10-1**: Nano Banana Proが利用できない場合のフォールバック戦略は？
- Imagen 3.0の個別生成に戻す？
- エラーメッセージを表示してユーザーに通知？

**Q10-2**: 段階的ロールアウトの方法は？
- 最初は一部のユーザーのみNano Banana Proを使用？
- A/Bテストでどちらが良いか検証？

---

## 実装順序の提案

以下の順序で実装を進めようと考えていますが、問題ないですか？

### Phase 1: プロトタイプ
1. Nano Banana ProのAPI呼び出しテスト（16:9生成確認）
2. 簡単なトリプティックプロンプトで生成テスト
3. 生成画像を手動で分割して確認

### Phase 2: 自動分割実装
1. サーバー側で画像分割ロジックを実装
2. R2に分割後の画像をアップロード
3. 既存の`variants`構造に統合

### Phase 3: モバイルアプリ統合
1. React Nativeでトリプティック画像の表示UI実装
2. カルーセルでビュー切り替え機能追加
3. ローディング状態の改善

### Phase 4: 本番デプロイ
1. エラーハンドリング強化
2. パフォーマンス最適化
3. ユーザーフィードバック収集

この順序で問題ないですか？変更すべき点はありますか？

---

## その他の懸念事項

**Q11-1**: トリプティック生成で「失敗しやすいケース」は何ですか？
- 複雑すぎるデザイン？
- 特定の色・素材？
- 特定のシルエット？

**Q11-2**: プロンプトの最大文字数制限は？
- トリプティック用のプロンプトは通常より長くなりますが、制限に引っかかりませんか？

**Q11-3**: negative_promptの設計は？
- 各ビューで異なるnegative_promptが必要ですか？
- それとも共通のnegative_promptで十分ですか？

---

## まとめ

以上の質問について、以下の観点から回答をお願いします:

1. **技術的実現可能性**: このアプローチは実現可能ですか？
2. **推奨される実装方法**: ベストプラクティスは何ですか？
3. **潜在的な問題点**: 見落としている課題はありますか？
4. **代替案**: より良いアプローチはありますか？

特に**Q2（プロンプト設計）**と**Q3（画像分割）**が最も重要なので、詳細な回答をお願いします。
