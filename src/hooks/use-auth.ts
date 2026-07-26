import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type AuthResult = { error: string | null };

function mapAuthError(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';

  if (/invalid login credentials/i.test(message)) return 'Email hoặc mật khẩu không đúng.';
  if (/already registered|already exists/i.test(message)) return 'Email này đã được đăng ký.';

  return message || 'Đã xảy ra lỗi, vui lòng thử lại.';
}

const NETWORK_ERROR_MESSAGE = 'Không có kết nối mạng, vui lòng thử lại.';

/**
 * Quản lý session Supabase Auth và cung cấp các hàm đăng nhập/đăng ký/đăng xuất.
 * Tách khỏi UI để component chỉ lo hiển thị + validate input.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ? mapAuthError(error) : null };
    } catch {
      return { error: NETWORK_ERROR_MESSAGE };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      return { error: error ? mapAuthError(error) : null };
    } catch {
      return { error: NETWORK_ERROR_MESSAGE };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { session, initializing, signIn, signUp, signOut };
}
