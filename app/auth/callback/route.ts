import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const redirect = requestUrl.searchParams.get('redirect');

  // code がない場合はエラー
  if (!code) {
    console.error('[auth/callback] No code parameter found');
    return NextResponse.redirect(new URL('/login?error=no_code', requestUrl.origin));
  }

  // redirect パラメータの検証（open redirect 対策）
  let redirectPath = '/admin/add'; // デフォルト
  if (redirect) {
    // 同一オリジン内のパスのみ許可
    // http://, https://, // で始まるものは拒否
    if (
      redirect.startsWith('http://') ||
      redirect.startsWith('https://') ||
      redirect.startsWith('//') ||
      redirect.startsWith('javascript:') ||
      redirect.startsWith('data:')
    ) {
      console.warn('[auth/callback] Invalid redirect URL:', redirect);
      // 無効な場合はデフォルトにフォールバック
    } else if (redirect.startsWith('/')) {
      // / で始まるパスのみ許可
      redirectPath = redirect;
    }
  }

  // Supabase server-side client を作成
  const response = NextResponse.redirect(new URL(redirectPath, requestUrl.origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // code をセッションに交換
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth/callback] Error exchanging code for session:', error);
    return NextResponse.redirect(new URL('/login?error=exchange_failed', requestUrl.origin));
  }

  // セッション確立後、リダイレクト
  return response;
}

