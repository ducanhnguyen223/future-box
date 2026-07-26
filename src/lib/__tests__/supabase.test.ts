jest.mock('expo-constants', () => ({
  expoConfig: { extra: { supabaseUrl: 'https://test.supabase.co', supabaseAnonKey: 'anon-key' } },
}));

describe('supabase client', () => {
  it('creates a client without throwing when config is present', () => {
    expect(() => require('../supabase')).not.toThrow();
  });

  it('exposes an auth module', () => {
    const { supabase } = require('../supabase');
    expect(supabase.auth).toBeDefined();
  });
});
