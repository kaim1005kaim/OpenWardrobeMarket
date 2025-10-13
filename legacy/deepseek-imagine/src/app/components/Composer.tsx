import { useState, useRef } from 'react';
import { Icons } from './Icons';

interface ComposerProps {
  onSend: (message: string) => void;
  onAttach: (file: File) => void;
  disabled?: boolean;
  placeholder?: string;
}

const QUICK_CHIPS = [
  'カジュアル',
  'フォーマル',
  'ストリート',
  'ミニマル',
  'エレガント',
  'ボヘミアン'
];

export function Composer({ onSend, onAttach, disabled, placeholder = "例）モノクロで都会的。夜のナイトアウト向け" }: ComposerProps) {
  const [message, setMessage] = useState('');
  const [showQuickChips, setShowQuickChips] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
      setShowQuickChips(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAttach(file);
    }
  };

  const handleChipSelect = (chip: string) => {
    setMessage(chip);
    setShowQuickChips(false);
    textareaRef.current?.focus();
  };

  return (
    <>
      {/* Quick chips overlay */}
      {showQuickChips && (
        <div className="absolute bottom-full left-0 right-0 mb-2">
          <div className="max-w-3xl mx-auto px-3">
            <div className="card p-3 bg-white/95 backdrop-blur">
              <p className="text-xs text-ink-400 mb-2">よく使うフレーズ</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    className="chip text-xs"
                    onClick={() => handleChipSelect(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="sticky bottom-0 border-t border-ink-200 bg-white/95 backdrop-blur z-20">
        <div className="max-w-3xl mx-auto px-3 py-3">
          <div className="flex items-end gap-3">
            {/* Attach button */}
            <button
              className="min-w-[54px] h-[54px] rounded-xl border border-ink-200 flex items-center justify-center bg-white hover:bg-ink-50 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              aria-label="画像を添付"
            >
              <Icons.Attach size={18} />
            </button>


            {/* Text input */}
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={placeholder}
                disabled={disabled}
                rows={1}
                className="w-full resize-none rounded-xl border border-ink-200 px-4 py-3 text-sm
                         focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20
                         disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ maxHeight: '120px', minHeight: '48px' }}
              />
            </div>

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!message.trim() || disabled}
              className="h-[54px] px-4 rounded-xl bg-accent text-white border border-accent hover:bg-accent/90 disabled:bg-ink-200 disabled:text-ink-400 disabled:border-ink-200 flex items-center gap-2 font-medium text-sm"
            >
              <Icons.Send size={16} />
              送信
            </button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </>
  );
}