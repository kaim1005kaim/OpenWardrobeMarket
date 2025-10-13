'use client';

import { useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';
import { Icons } from './Icons';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0"
      style={{ 
        zIndex: 99999,
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      {/* Modal Container with scroll */}
      <div 
        className="flex min-h-full items-center justify-center p-4 overflow-y-auto"
        style={{ 
          position: 'relative',
          zIndex: 99999
        }}
      >
        {/* Modal */}
        <div 
          className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">サインイン / サインアップ</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
          >
            <Icons.ArrowLeft size={18} />
          </button>
        </div>

        <Auth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#000000',
                  brandAccent: '#333333',
                },
              },
            },
          }}
          providers={['google']}
          redirectTo={`${window.location.origin}/auth/callback`}
          localization={{
            variables: {
              sign_in: {
                email_label: 'メールアドレス',
                password_label: 'パスワード',
                button_label: 'サインイン',
                loading_button_label: 'サインイン中...',
                social_provider_text: '{{provider}}でサインイン',
                link_text: 'アカウントをお持ちの方はこちら',
                email_input_placeholder: 'メールアドレスを入力',
                password_input_placeholder: 'パスワードを入力',
              },
              sign_up: {
                email_label: 'メールアドレス',
                password_label: 'パスワード',
                button_label: 'サインアップ',
                loading_button_label: 'サインアップ中...',
                social_provider_text: '{{provider}}でサインアップ',
                link_text: 'アカウントをお持ちでない方はこちら',
                email_input_placeholder: 'メールアドレスを入力',
                password_input_placeholder: 'パスワードを入力',
                confirmation_text: '確認用メールを送信しました',
              },
              forgotten_password: {
                email_label: 'メールアドレス',
                button_label: 'パスワードリセット',
                link_text: 'パスワードをお忘れですか？',
                confirmation_text: 'パスワードリセット用メールを送信しました',
              },
            },
          }}
        />
        </div>
      </div>
    </div>
  );
}