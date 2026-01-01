'use client';

import Link from 'next/link';
import { useAdminMode } from '@/contexts/AdminModeContext';

const ADMIN_PASSWORD = 'kamaishi2026';

export default function Header() {
  const { isAdminMode, setIsAdminMode } = useAdminMode();

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

  return (
    <header className="bg-navy-900 text-white shadow-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            Reporter&apos;s Note
          </Link>
          <div className="flex items-center gap-4">
            <button
              onClick={handleToggle}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium"
            >
              {isAdminMode ? '管理者モード' : 'ワーカーモード'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

