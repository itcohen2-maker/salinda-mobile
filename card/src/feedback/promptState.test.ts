import {
  FEEDBACK_PROMPT_COOLDOWN_MS,
  FEEDBACK_PROMPT_SESSION_INTERVAL,
  buildFeedbackMailtoUrl,
  canOfferFeedbackPrompt,
  DEFAULT_FEEDBACK_PROMPT_STATE,
  markFeedbackPromptHandled,
  normalizeFeedbackPromptState,
  recordCompletedFeedbackSession,
} from './promptState';

describe('feedback prompt rules', () => {
  it('offers the first prompt after the first completed session', () => {
    const next = recordCompletedFeedbackSession(DEFAULT_FEEDBACK_PROMPT_STATE);

    expect(canOfferFeedbackPrompt(next, 1_000)).toBe(true);
  });

  it('waits for the cooldown even after enough completed sessions', () => {
    const now = 500_000;
    const handled = {
      ...DEFAULT_FEEDBACK_PROMPT_STATE,
      completedSessionsCount: 1,
      lastPromptSessionCount: 1,
      lastPromptAt: now,
      lastHandledType: 'submitted' as const,
    };
    const next = {
      ...handled,
      completedSessionsCount: handled.completedSessionsCount + FEEDBACK_PROMPT_SESSION_INTERVAL,
    };

    expect(canOfferFeedbackPrompt(next, now + FEEDBACK_PROMPT_COOLDOWN_MS - 1)).toBe(false);
    expect(canOfferFeedbackPrompt(next, now + FEEDBACK_PROMPT_COOLDOWN_MS)).toBe(true);
  });

  it('does not re-offer before the session interval is reached', () => {
    const handled = {
      ...DEFAULT_FEEDBACK_PROMPT_STATE,
      completedSessionsCount: 8,
      lastPromptSessionCount: 8,
      lastPromptAt: 10,
      lastHandledType: 'dismissed' as const,
    };
    const next = {
      ...handled,
      completedSessionsCount: handled.completedSessionsCount + FEEDBACK_PROMPT_SESSION_INTERVAL - 1,
    };

    expect(canOfferFeedbackPrompt(next, 10 + FEEDBACK_PROMPT_COOLDOWN_MS + 10)).toBe(false);
  });

  it('marks handled prompts with the current session count', () => {
    const state = {
      ...DEFAULT_FEEDBACK_PROMPT_STATE,
      completedSessionsCount: 14,
    };

    expect(markFeedbackPromptHandled(state, 'dismissed', 777)).toEqual({
      completedSessionsCount: 14,
      lastPromptSessionCount: 14,
      lastPromptAt: 777,
      lastHandledType: 'dismissed',
    });
  });

  it('normalizes malformed persisted state', () => {
    expect(
      normalizeFeedbackPromptState({
        completedSessionsCount: 3.9,
        lastPromptSessionCount: -4,
        lastPromptAt: 'bad',
        lastHandledType: 'oops',
      }),
    ).toEqual({
      completedSessionsCount: 3,
      lastPromptSessionCount: 0,
      lastPromptAt: null,
      lastHandledType: null,
    });
  });
});

describe('buildFeedbackMailtoUrl', () => {
  it('includes localized subject, kind, rating and comment', () => {
    const url = buildFeedbackMailtoUrl({
      locale: 'he',
      kind: 'tutorial',
      rating: 4,
      comment: 'היה ברור ונעים',
    });
    const decoded = decodeURIComponent(url);

    expect(decoded).toContain('mailto:salindagame@gmail.com?subject=פידבק על Salinda');
    expect(decoded).toContain('סוג חוויה: הדרכה');
    expect(decoded).toContain('דירוג: ★★★★ (4/5)');
    expect(decoded).toContain('הערה:\nהיה ברור ונעים');
  });

  it('supports general feedback from the home screen', () => {
    const url = buildFeedbackMailtoUrl({
      locale: 'en',
      kind: 'general',
      rating: 5,
    });
    const decoded = decodeURIComponent(url);

    expect(decoded).toContain('Experience: General');
    expect(decoded).toContain('Rating: ★★★★★ (5/5)');
  });
});
