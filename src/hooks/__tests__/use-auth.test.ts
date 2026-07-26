import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockSignOut = jest.fn();
const mockGetSession = jest.fn().mockResolvedValue({ data: { session: null } });
const mockOnAuthStateChange = jest
  .fn()
  .mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
  },
}));

import { useAuth } from '@/hooks/use-auth';

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  });

  it('finishes initializing with no session when nothing stored', async () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.initializing).toBe(true);

    await waitFor(() => expect(result.current.initializing).toBe(false));
    expect(result.current.session).toBeNull();
  });

  it('signs in successfully', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { session: {}, user: {} }, error: null });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.initializing).toBe(false));

    let response;
    await act(async () => {
      response = await result.current.signIn('user@example.com', 'secret123');
    });

    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'user@example.com', password: 'secret123' });
    expect(response).toEqual({ error: null });
  });

  it('reports a clear error on wrong password', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.initializing).toBe(false));

    let response;
    await act(async () => {
      response = await result.current.signIn('user@example.com', 'wrong-password');
    });

    expect(response).toEqual({ error: 'Email hoặc mật khẩu không đúng.' });
  });

  it('signs up successfully', async () => {
    mockSignUp.mockResolvedValue({ data: { user: {}, session: {} }, error: null });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.initializing).toBe(false));

    let response;
    await act(async () => {
      response = await result.current.signUp('new@example.com', 'secret123');
    });

    expect(mockSignUp).toHaveBeenCalledWith({ email: 'new@example.com', password: 'secret123' });
    expect(response).toEqual({ error: null });
  });

  it('reports a clear error when the email is already registered', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.initializing).toBe(false));

    let response;
    await act(async () => {
      response = await result.current.signUp('existing@example.com', 'secret123');
    });

    expect(response).toEqual({ error: 'Email này đã được đăng ký.' });
  });

  it('returns a network error message instead of throwing when the request rejects', async () => {
    mockSignInWithPassword.mockRejectedValue(new Error('Network request failed'));
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.initializing).toBe(false));

    let response;
    await act(async () => {
      response = await result.current.signIn('user@example.com', 'secret123');
    });

    expect(response).toEqual({ error: 'Không có kết nối mạng, vui lòng thử lại.' });
  });
});
