import { Asset } from '../lib/types';
import { useState } from 'react';

interface PurchasePageProps {
  asset: Asset;
  onClose: () => void;
}

export function PurchasePage({ asset, onClose }: PurchasePageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [kanaLastName, setKanaLastName] = useState('');
  const [kanaFirstName, setKanaFirstName] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [prefecture, setPrefecture] = useState('日本');
  const [city, setCity] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [cvv, setCvv] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('credit');
  const [showPassword, setShowPassword] = useState(false);
  const [upgradeSelected, setUpgradeSelected] = useState(false);

  const subtotal = asset.price || 17506;
  const shippingFee = 1638;
  const upgradePrice = 5792;
  const total = subtotal + shippingFee + (upgradeSelected ? upgradePrice : 0);

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white shadow-sm">
          <div className="px-6 py-4 flex items-center justify-between border-b">
            <h1 className="text-xl font-bold">購入手続き</h1>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex gap-6 p-6">
          {/* Left Column - Forms */}
          <div className="flex-1 max-w-md">
            {/* 会員登録 */}
            <div className="bg-white rounded-lg border p-6 mb-4">
              <h2 className="text-lg font-bold mb-4">会員登録</h2>
              <div className="text-sm text-gray-600 mb-4">
                既にお客様の方は、こちらからサインイン
              </div>
              <div className="space-y-3">
                <input
                  type="email"
                  placeholder="Eメールアドレス"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="パスワード"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    👁
                  </button>
                </div>
              </div>
            </div>

            {/* ご請求先情報 */}
            <div className="bg-white rounded-lg border p-6 mb-4">
              <h2 className="text-lg font-bold mb-4">ご請求先情報</h2>
              <div className="space-y-3">
                <select
                  value={prefecture}
                  onChange={(e) => setPrefecture(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="日本">日本</option>
                </select>
                
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="姓"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    placeholder="名"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="姓（カタカナ全角）"
                    value={kanaLastName}
                    onChange={(e) => setKanaLastName(e.target.value)}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    placeholder="名（カタカナ全角）"
                    value={kanaFirstName}
                    onChange={(e) => setKanaFirstName(e.target.value)}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <input
                  placeholder="郵便番号（半角ハイフン付き）"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <select
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>選択</option>
                  <option>東京都</option>
                  <option>大阪府</option>
                  <option>神奈川県</option>
                </select>

                <input
                  placeholder="市区町村"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <input
                  placeholder="番地、番号（1丁目1-1）/ 建物名（2段目に入力）"
                  value={address1}
                  onChange={(e) => setAddress1(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <input
                  placeholder="アパート名、ビル名、階数など"
                  value={address2}
                  onChange={(e) => setAddress2(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <div className="flex gap-2">
                  <span className="px-3 py-2 bg-gray-100 border rounded-md">+81</span>
                  <input
                    placeholder="電話番号"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button className="text-blue-600 text-sm mt-3">
                会社または組織名を追加
              </button>
            </div>

            {/* お支払い情報 */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-bold mb-4">お支払い情報</h2>
              
              <div className="mb-4">
                <button 
                  onClick={() => setPaymentMethod('credit')}
                  className={`px-4 py-2 rounded-md border ${
                    paymentMethod === 'credit' ? 'bg-gray-100 border-gray-400' : 'bg-white'
                  }`}
                >
                  クレジットカード
                </button>
              </div>

              <div className="space-y-3 mb-4">
                <input
                  placeholder="クレジットカード番号"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                
                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="所有者"
                    value={cardholderName}
                    onChange={(e) => setCardholderName(e.target.value)}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    placeholder="セキュリティコード"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value)}
                    className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="text-sm text-gray-600 mb-4">
                このカードはアカウントに保存されます。
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input 
                    type="radio" 
                    name="payment" 
                    checked={paymentMethod === 'paypal'}
                    onChange={() => setPaymentMethod('paypal')}
                  />
                  <span className="text-sm">PayPal</span>
                </label>
                <label className="flex items-center gap-2">
                  <input 
                    type="radio" 
                    name="payment"
                    checked={paymentMethod === 'googlepay'}
                    onChange={() => setPaymentMethod('googlepay')}
                  />
                  <span className="text-sm">Google Pay</span>
                </label>
              </div>

              <div className="mt-4 pt-4 border-t text-xs text-gray-600">
                お客様の購入情報は安全に保護されます。
                定期購読サービスをご利用の場合、毎月自動的に更新されます。
                キャンセルはいつでも可能です。ご不明な点がございましたら、
                カスタマーサポートまでお問い合わせください。
                <a href="#" className="text-blue-600">キャンセルポリシー</a>、
                <a href="#" className="text-blue-600">返金ポリシー</a>についてもご確認いただけます。
              </div>
            </div>
          </div>

          {/* Right Column - Order Summary */}
          <div className="w-96">
            <div className="bg-white rounded-lg border p-6 sticky top-6">
              <h2 className="text-lg font-bold mb-4">ご購入内容</h2>
              
              <div className="flex gap-3 mb-4">
                <img
                  src={asset.src}
                  alt={asset.title}
                  className="w-16 h-16 object-cover rounded"
                />
                <div>
                  <div className="font-medium">{asset.title}</div>
                  <div className="text-sm text-gray-600">{asset.creator || 'OWM Creator'}</div>
                </div>
              </div>

              <div className="space-y-2 pb-4 border-b">
                <div className="flex justify-between text-sm">
                  <span>小計</span>
                  <span>¥{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>JPVAT</span>
                  <span>¥{shippingFee.toLocaleString()}</span>
                </div>
              </div>

              <div className="py-4">
                <label className="flex items-start gap-2">
                  <input 
                    type="checkbox"
                    checked={upgradeSelected}
                    onChange={(e) => setUpgradeSelected(e.target.checked)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <span className="text-sm">アップグレードすると追加5項目の割引</span>
                    <span className="text-sm text-gray-600 ml-2">+¥5,792</span>
                  </div>
                </label>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between font-bold text-lg mb-4">
                  <span>合計</span>
                  <span>¥{total.toLocaleString()}</span>
                </div>

                <div className="text-xs text-gray-600 mb-4">
                  定期購読サービスをご利用の場合、初回購入日から自動的に更新されます。
                  月払い、年払いなどのプランをお選びいただけます。
                  詳細な料金体系については、各商品ページでご確認ください。
                </div>

                <a href="#" className="text-blue-600 text-sm block mb-6">
                  プロモーションコードをお持ちの場合
                </a>

                <button
                  onClick={() => {
                    alert('購入が完了しました！');
                    onClose();
                  }}
                  className="w-full bg-red-500 text-white py-3 rounded-md font-medium hover:bg-red-600 transition-colors"
                >
                  同意して、購入する
                </button>

                <div className="text-center mt-6">
                  <div className="text-sm text-gray-600">合計</div>
                  <div className="text-2xl font-bold">¥{total.toLocaleString()}</div>
                </div>

                <div className="text-xs text-gray-600 mt-4">
                  領収書をご希望の場合は、メールにてお送りいたします。
                  <br /><br />
                  ご購入いただくことで、
                  <a href="#" className="text-blue-600">プライバシーポリシー</a>および
                  <a href="#" className="text-blue-600">利用規約</a>に同意したものとみなされます。
                  ご不明な点がございましたら、お気軽にお問い合わせください。
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}