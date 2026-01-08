'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdminMode } from '@/contexts/AdminModeContext';
import { supabase } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

const ADMIN_PASSWORD = 'kamaishi2026';

export default function Header() {
  const router = useRouter();
  const { isAdminMode, setIsAdminMode } = useAdminMode();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ログイン状態を確認
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // 認証状態の変更を監視
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleToggle = () => {
    // ワーカーモードに戻す場合はパスワード不要
    if (isAdminMode) {
      setIsAdminMode(false);
      return;
    }

    // 管理者モードに切り替える場合はパスワード認証
    const password = window.prompt('管理者パスワードを入力してください');
    
    if (password === null) {
      // キャンセルが押された場合は何もしない
      return;
    }

    if (password === ADMIN_PASSWORD) {
      setIsAdminMode(true);
    } else {
      alert('パスワードが違います');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="bg-navy-900 text-white shadow-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            Reporter&apos;s Note
          </Link>
          <div className="flex items-center gap-4">
            {!loading && (
              <>
                {user ? (
                  <>
                    <span className="text-sm text-white/80">
                      {user.email}
                    </span>
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium"
                    >
                      ログアウト
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium"
                  >
                    ログイン
                  </Link>
                )}
                {user && (
                  <button
                    onClick={handleToggle}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium"
                  >
                    {isAdminMode ? '管理者モード' : 'ワーカーモード'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

