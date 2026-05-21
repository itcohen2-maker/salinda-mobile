export const FEEDBACK_PROMPT_STORAGE_KEY = 'salinda_feedback_prompt_state_v1';
export const FEEDBACK_PROMPT_SESSION_INTERVAL = 10;
export const FEEDBACK_PROMPT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type FeedbackExperienceKind = 'game' | 'tutorial' | 'general';
export type FeedbackPromptHandledType = 'submitted' | 'dismissed';

export interface FeedbackPromptState {
  completedSessionsCount: number;
  lastPromptSessionCount: number;
  lastPromptAt: number | null;
  lastHandledType: FeedbackPromptHandledType | null;
}

export const DEFAULT_FEEDBACK_PROMPT_STATE: FeedbackPromptState = {
  completedSessionsCount: 0,
  lastPromptSessionCount: 0,
  lastPromptAt: null,
  lastHandledType: null,
};

function clampNonNegativeInt(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function normalizeFeedbackPromptState(value: unknown): FeedbackPromptState {
  if (!value || typeof value !== 'object') return DEFAULT_FEEDBACK_PROMPT_STATE;
  const candidate = value as Partial<FeedbackPromptState>;
  const lastPromptAt =
    typeof candidate.lastPromptAt === 'number' && Number.isFinite(candidate.lastPromptAt)
      ? candidate.lastPromptAt
      : null;
  const lastHandledType =
    candidate.lastHandledType === 'submitted' || candidate.lastHandledType === 'dismissed'
      ? candidate.lastHandledType
      : null;

  return {
    completedSessionsCount: clampNonNegativeInt(candidate.completedSessionsCount),
    lastPromptSessionCount: clampNonNegativeInt(candidate.lastPromptSessionCount),
    lastPromptAt,
    lastHandledType,
  };
}

export function recordCompletedFeedbackSession(state: FeedbackPromptState): FeedbackPromptState {
  return {
    ...state,
    completedSessionsCount: state.completedSessionsCount + 1,
  };
}

export function canOfferFeedbackPrompt(
  state: FeedbackPromptState,
  now = Date.now(),
): boolean {
  const sessionsSinceLastPrompt =
    state.completedSessionsCount - state.lastPromptSessionCount;
  const meetsSessionThreshold =
    state.lastPromptSessionCount <= 0
      ? state.completedSessionsCount >= 1
      : sessionsSinceLastPrompt >= FEEDBACK_PROMPT_SESSION_INTERVAL;
  const meetsCooldown =
    state.lastPromptAt == null ||
    now - state.lastPromptAt >= FEEDBACK_PROMPT_COOLDOWN_MS;

  return meetsSessionThreshold && meetsCooldown;
}

export function markFeedbackPromptHandled(
  state: FeedbackPromptState,
  handledType: FeedbackPromptHandledType,
  now = Date.now(),
): FeedbackPromptState {
  return {
    ...state,
    lastPromptSessionCount: state.completedSessionsCount,
    lastPromptAt: now,
    lastHandledType: handledType,
  };
}
