import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function AuthCallback() {
  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Auth callback error:', error);
        window.location.href = '/?error=auth_error';
        return;
      }

      if (data.session) {
        window.location.href = '/?auth=success';
      } else {
        window.location.href = '/';
      }
    };

    handleAuthCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
        <p>認証処理中...</p>
      </div>
    </div>
  );
}