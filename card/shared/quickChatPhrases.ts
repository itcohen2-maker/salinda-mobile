export const QUICK_CHAT_PHRASES = [
  { id: 'QUICK_MSG_HELLO', text: 'אהלן לכולם! 👋' },
  { id: 'QUICK_MSG_GOODLUCK', text: 'בהצלחה! 🍀' },
  { id: 'QUICK_MSG_HURRY', text: 'השעון מתקתק... ⏳' },
  { id: 'QUICK_MSG_AWESOME', text: 'וואו, איזה מהלך! 🤯' },
  { id: 'QUICK_MSG_NERVOUS', text: 'יש לי קלף פרא, ראו הוזהרתם! 🐺' },
  { id: 'QUICK_MSG_GG', text: 'כל הכבוד, שיחקת אותה 👑' },
  { id: 'QUICK_MSG_SLEEP', text: 'מישהו נרדם שם? 😴' },
] as const;

export type QuickChatPhraseId = (typeof QUICK_CHAT_PHRASES)[number]['id'];

const QUICK_CHAT_PHRASE_IDS = new Set<string>(QUICK_CHAT_PHRASES.map((phrase) => phrase.id));

export function isQuickChatPhraseId(value: unknown): value is QuickChatPhraseId {
  return typeof value === 'string' && QUICK_CHAT_PHRASE_IDS.has(value);
}

export function getQuickChatPhraseText(id: QuickChatPhraseId): string {
  return QUICK_CHAT_PHRASES.find((phrase) => phrase.id === id)?.text ?? '';
}
