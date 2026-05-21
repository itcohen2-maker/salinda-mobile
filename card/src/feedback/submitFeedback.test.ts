import { supabase } from '../lib/supabase';
import { submitFeedback } from './submitFeedback';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '9.9.9',
    },
  },
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe('submitFeedback', () => {
  const fromMock = supabase.from as jest.Mock;
  const insertMock = jest.fn();

  beforeEach(() => {
    insertMock.mockReset();
    fromMock.mockReset();
    fromMock.mockReturnValue({ insert: insertMock });
  });

  it('stores anonymous feedback without an email snapshot', async () => {
    insertMock.mockResolvedValue({ error: null });

    const result = await submitFeedback({
      comment: 'Great game',
      kind: 'game',
      locale: 'he',
      profile: { username: 'noa' } as any,
      rating: 4,
      user: {
        id: 'anon-user-id',
        is_anonymous: true,
        user_metadata: {},
      } as any,
    });

    expect(result).toBe('submitted');
    expect(fromMock).toHaveBeenCalledWith('feedback_submissions');
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      app_version: '9.9.9',
      comment: 'Great game',
      email_snapshot: null,
      experience_kind: 'game',
      is_anonymous: true,
      locale: 'he',
      platform: expect.any(String),
      rating: 4,
      user_id: 'anon-user-id',
      username_snapshot: 'noa',
    }));
  });

  it('stores upgraded-user feedback with an email snapshot', async () => {
    insertMock.mockResolvedValue({ error: null });

    const result = await submitFeedback({
      comment: 'Needs clearer rules',
      kind: 'tutorial',
      locale: 'en',
      profile: { username: 'alex' } as any,
      rating: 5,
      user: {
        email: 'alex@example.com',
        id: 'user-123',
        is_anonymous: false,
        user_metadata: {},
      } as any,
    });

    expect(result).toBe('submitted');
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      email_snapshot: 'alex@example.com',
      is_anonymous: false,
      user_id: 'user-123',
      username_snapshot: 'alex',
    }));
  });

  it('stores an empty string when the comment is blank', async () => {
    insertMock.mockResolvedValue({ error: null });

    const result = await submitFeedback({
      comment: '   ',
      kind: 'general',
      locale: 'en',
      profile: null,
      rating: 3,
      user: {
        id: 'user-456',
        is_anonymous: false,
        user_metadata: { username: 'guest_name' },
      } as any,
    });

    expect(result).toBe('submitted');
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      comment: '',
      username_snapshot: 'guest_name',
    }));
  });

  it('returns error when Supabase insert fails', async () => {
    insertMock.mockResolvedValue({ error: { message: 'insert failed' } });

    const result = await submitFeedback({
      comment: 'Broken',
      kind: 'general',
      locale: 'en',
      profile: null,
      rating: 2,
      user: {
        id: 'user-789',
        is_anonymous: false,
        user_metadata: {},
      } as any,
    });

    expect(result).toBe('error');
  });
});
