import { beforeAll, vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock environment variables for Supabase
beforeAll(() => {
  // Set up mock environment variables
  import.meta.env.VITE_SUPABASE_URL = 'https://mock-supabase-url.supabase.co';
  import.meta.env.VITE_SUPABASE_KEY = 'mock-supabase-key';
});

// Mock Supabase client
vi.mock('../core/apis/supabase', () => ({
  default: {
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      refreshSession: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      eq: vi.fn(),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        remove: vi.fn(),
        getPublicUrl: vi.fn(),
      })),
    },
  },
}));

