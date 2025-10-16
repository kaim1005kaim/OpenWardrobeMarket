/**
 * UI Copy / Text Constants
 *
 * ページタイトル: Trajan Pro / ALL CAPS 固定
 * CTA・本文: 日本語 / システムフォント
 */

export const COPY = {
  // ===== PAGES（英語タイトル＝Trajan・ALL CAPS固定）=====
  pages: {
    STUDIO: "STUDIO",       // はじまりの場＝アトリエ
    SHOWCASE: "SHOWCASE",   // 作品が並ぶ"見せ場"
    CREATE: "CREATE",       // 生成・育成の場
    ARCHIVE: "ARCHIVE",     // MY ARCHIVE: 自分の公開/保管物の棚
    REVIEW: "REVIEW",       // 公開前の確認
    REFINE: "REFINE",       // 微調整・仕上げ
    PUBLISH: "PUBLISH",     // 公開・リリース
  },

  // ===== NAVIGATION（英語固定・ALL CAPS）=====
  nav: {
    STUDIO: "STUDIO",
    SHOWCASE: "SHOWCASE",
    CREATE: "CREATE",
    ARCHIVE: "ARCHIVE",
  },

  // ===== CTA / PRIMARY ACTIONS =====
  cta: {
    heroPrimary: "その感性を、かたちに。",
    heroSecondary: "アイデアの原石を、最初のルックへ。",
    generate: "息吹を吹き込む",
    publish: "ショーケースに並べる",
    toGallery: "ショーケースを眺める",
  },

  // ===== TOAST / STATUS =====
  status: {
    publishSuccess: "✓ ショーケースに並びました",
    publishError: "✕ 公開に失敗しました。少し待ってからもう一度お試しください。",
    unpublishSuccess: "✓ 非公開に戻しました",
  },

  // ===== LOADING STATES =====
  loading: {
    preparing: "デザインの原石を磨いています…",
    coaching: "ひらめきの糸を紡いでいます…",
    auth: "鍵を確認しています…",
    listing: "アーカイブを並べています…",
    generating: "ガラス越しに生成中…",
    analyzing: "DNAを解析中…",
  },

  // ===== DRAFT / SAVE =====
  drafts: {
    button: "アトリエに寝かせる",
    tab: "育成中のルック",
    saved: "✓ アイデアをアトリエに保管しました。いつでも続きを。",
    failed: "✕ 保管に失敗しました。接続を確かめて、もう一度。",
  },

  // ===== CREATE FLOW =====
  flow: {
    restart: "最初からやり直す",
    back: "直前の工程に戻る",
    skip: "いまの状態を確認",
    toPreview: "ショーケースで確認",
    chips: "デザインの系譜",
    reflected: "微調整をDNAに刻みました。ルックに反映します。",
    next: "次へ",
    guidance: "デザインを整える",
    guidanceTooltip: "あなたのアイデアを文字でお伝えください",
    previewTooltip: "ガラス越しに、仕上がりを見ます。",
    placeholder: "例: 赤い帽子、異素材、スケーターファッション",
    coachButton: "意匠を提案",
    coachButtonLoading: "ひらめきの糸を紡いでいます…",
    multiSelectHint: "複数選択可能です",
  },

  // ===== ERROR MESSAGES =====
  errors: {
    guidance: "インスピレーションが少し遠いようです。言葉を変えて、もう一度呼びかけてみましょう。",
    upload: "保管に失敗しました。接続を確かめて、もう一度。",
    like: "記録できませんでした。少し待って再試行してください。",
    needTitle: "タイトルをください。短い呼び名が似合います。",
    needCategory: "このルックは、どのデザインの系譜に連なりますか？最も近いと感じる棚へどうぞ。",
    generateFailed: "生成に失敗しました。接続を確かめて、もう一度。",
    noImage: "生成された画像がありません。",
    loginRequired: "ログインが必要です。",
    deleteFailed: "削除に失敗しました。",
    updateFailed: "更新に失敗しました。",
  },

  // ===== AUTH FLOW =====
  auth: {
    verifying: "鍵を準備しています…",
    authenticating: "認証しています…",
    pleaseWaitEn: "Please wait while we verify your access.",
    mailSent: "確認メールを送りました。リンクを開くと入室できます。",
    magicLink: "リンクでログインできます。受信箱をご確認ください。",
    inAppBlocked: "Googleの仕様により、この窓ではログインできません。外部ブラウザでお試しください。",
    loginFailed: "ログインに失敗しました",
    signupFailed: "登録に失敗しました",
    emailSendFailed: "メール送信に失敗しました",
  },

  // ===== PUBLISH COMPLETE =====
  publishDone: {
    title: "PUBLISH",
    body: "一つの才能が、世界に放たれました。",
    open: "公開ページをひらく",
    next: "このルックから、コレクションを始める",
  },

  // ===== MY PAGE (ARCHIVE) =====
  mypage: {
    title: "ARCHIVE",
    public: "公開ルック",
    drafts: "育成中のルック",
    collection: "コレクション",
    unpublish: "✓ 非公開に戻しました",
    empty: "まだ{tab}がありません",
    settings: "設定画面（実装予定）",
    design: "DESIGN",
    setting: "SETTING",
    publish: "Publish",
    draftTab: "Drafts",
    collections: "Collections",
  },

  // ===== PUBLISH FORM (REVIEW) =====
  review: {
    title: "デザインを公開する",
    estimatedPrice: "評価価格",
    platformFee: "販売手数料 (10%)",
    netProfit: "販売利益",
    titleLabel: "タイトル",
    categoryLabel: "カテゴリー",
    categoryPlaceholder: "カテゴリーを選択してください",
    descriptionLabel: "説明文",
    tagsLabel: "タグ設定",
    addTag: "タグを追加する",
    saleType: "販売タイプ",
    buyout: "買い切り",
    subscription: "サブスクリプション",
    salePrice: "販売価格",
    privacyNotice: "プライバシーポリシーに同意の上、「公開する」ボタンを押してください。",
    saveDraft: "アトリエに寝かせる",
    publish: "ショーケースに並べる",
  },

  // ===== FOOTER =====
  footer: {
    faq: "F.A.Q.",
    privacy: "PRIVACY POLICY",
    contact: "CONTACT",
    brand: "OPEN WARDROBE MARKET",
    tagline1: "DESIGN, GENERATE, AND PUBLISH YOUR ORIGINAL FASHION",
    tagline2: "FASHION POWERED BY OPEN DESIGN",
    copyright: "©︎2025 OPEN WARDROBE MARKET. ALL RIGHTS RESERVED.",
  },

  // ===== QUESTIONS =====
  questions: {
    vibe: "どんな雰囲気のデザインにしたいですか？",
    silhouette: "シルエットはどうしますか？",
    color: "カラーパレットを選択してください",
    occasion: "着用シーンは？",
    season: "シーズンは？",
  },

  // ===== MISC =====
  misc: {
    loading: "Loading...",
    noRecommendations: "まだ提案はありません",
    search: "Search",
    searchLabel: "SERCH", // Note: typo in original - keep for now
    menu: "Menu",
    close: "close",
    more: "more",
    logout: "LOGOUT",
    deleteConfirm: "本当に削除しますか？",
    buy: "BUY",
    likes: "likes",
    similarDesigns: "SIMILAR DESIGNS",
    showMore: "...詳細を見る",
    progress: "{step} / {total}",
  },
} as const;
