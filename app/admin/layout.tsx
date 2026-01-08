'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const ADMIN_EMAILS = ['h-suzuki@local-hack.biz'].map((s) => s.toLowerCase());

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const run = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        console.error('[admin] getUser error:', error);
      }

      const email = (user?.email || '').toLowerCase();
      const allowed = !!user && ADMIN_EMAILS.includes(email);

      if (!allowed) {
        router.replace('/');
        return;
      }

      setOk(true);
    };

    void run();
  }, [router]);

  if (!ok) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        確認中...
      </div>
    );
  }

  return <>{children}</>;
}
