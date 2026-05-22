import type { ArchiveCardSpec } from '../components/gameplay'

export type PrototypeChapterCard = ArchiveCardSpec & {
  accepted: boolean
  id: string
}

export type PrototypeRuleOption = {
  id: string
  isCorrect: boolean
  label: string
}

export type PrototypeChapterDefinition = {
  articleCode: string
  chapterCode: string
  completionLine: string
  correctRuleExplanation: string
  deck: readonly PrototypeChapterCard[]
  hints: readonly string[]
  idlePrompt: string
  incorrectGuessHint: string
  introEyebrow: string
  readyThreshold: number
  ruleOptions: readonly PrototypeRuleOption[]
  successHeading: string
  title: string
}

export function canNameRuleFromCounts(
  readyThreshold: number,
  satisfiesCount: number,
  contradictsCount: number,
) {
  return (
    satisfiesCount + contradictsCount >= readyThreshold &&
    satisfiesCount >= 2 &&
    contradictsCount >= 2
  )
}

export const PROTOTYPE_CHAPTERS: readonly PrototypeChapterDefinition[] = [
  {
    articleCode: '04',
    chapterCode: 'III',
    completionLine: 'פיצחת את החוק של הפרק הראשון. בפרק הבא הדפוס מתחלף לגמרי.',
    correctRuleExplanation:
      'נכון. כל קלף שמתאים לחוק נשען על פס אופקי במרכז הסמל. הקלפים שלא מתאימים שוברים את הקו הזה.',
    deck: [
      { id: 'chapter-1-card-01', catalog: 'II-11', glyph: 'paired-bars', accepted: true },
      { id: 'chapter-1-card-02', catalog: 'III-04', glyph: 'cut-diamond', accepted: false },
      { id: 'chapter-1-card-03', catalog: 'III-09', glyph: 'ring-axis', accepted: true },
      { id: 'chapter-1-card-04', catalog: 'II-17', glyph: 'triple-notch', accepted: true },
      { id: 'chapter-1-card-05', catalog: 'IV-02', glyph: 'tally-seal', accepted: false },
      { id: 'chapter-1-card-06', catalog: 'II-03', glyph: 'ladder-rungs', accepted: true },
      { id: 'chapter-1-card-07', catalog: 'III-11', glyph: 'nested-arc', accepted: false },
      { id: 'chapter-1-card-08', catalog: 'II-06', glyph: 'cut-diamond', accepted: false },
    ],
    hints: [
      'עזוב את מספרי הקטלוג. החוק יושב בתוך הסמל עצמו.',
      'חפש קו אופקי ברור שחוצה את מרכז הסמל.',
    ],
    idlePrompt: 'יש חוק נסתר. בחר קלף והתחל לחקור.',
    incorrectGuessHint:
      'לא זה. תסתכל שוב על הקלפים שמתאימים לחוק: בכולם יש פס אופקי ברור באזור המרכז.',
    introEyebrow: 'פרק III / רשומה 04',
    readyThreshold: 4,
    ruleOptions: [
      {
        id: 'chapter-1-rule-center-bar',
        isCorrect: true,
        label: 'הקלף מתאים לחוק רק אם יש פס אופקי ברור במרכז הסמל.',
      },
      {
        id: 'chapter-1-rule-double-mark',
        isCorrect: false,
        label: 'הקלף מתאים לחוק רק אם יש שני סימנים זהים זה מול זה.',
      },
      {
        id: 'chapter-1-rule-open-form',
        isCorrect: false,
        label: 'הקלף מתאים לחוק רק אם הסמל פתוח ואינו נסגר לצורה מלאה.',
      },
    ],
    successHeading: 'פיצחת!',
    title: 'הסדר ההדדי',
  },
  {
    articleCode: '07',
    chapterCode: 'IV',
    completionLine: 'גם זה נפתח. כרגע זה סוף הדמו, אבל כבר יש רצף אמיתי בין פרקים.',
    correctRuleExplanation:
      'בול. כל קלף שמתאים לחוק סוגר את הסמל בתוך מסגרת, טבעת או צורה מקיפה. הקלפים שלא מתאימים נשארים פתוחים.',
    deck: [
      { id: 'chapter-2-card-01', catalog: 'IV-11', glyph: 'ring-axis', accepted: true },
      { id: 'chapter-2-card-02', catalog: 'IV-13', glyph: 'paired-bars', accepted: false },
      { id: 'chapter-2-card-03', catalog: 'IV-17', glyph: 'nested-arc', accepted: true },
      { id: 'chapter-2-card-04', catalog: 'V-02', glyph: 'ladder-rungs', accepted: false },
      { id: 'chapter-2-card-05', catalog: 'V-06', glyph: 'triple-notch', accepted: true },
      { id: 'chapter-2-card-06', catalog: 'V-08', glyph: 'tally-seal', accepted: true },
      { id: 'chapter-2-card-07', catalog: 'V-10', glyph: 'cut-diamond', accepted: true },
      { id: 'chapter-2-card-08', catalog: 'V-14', glyph: 'paired-bars', accepted: false },
    ],
    hints: [
      'הפעם לא צריך לחפש קו אחד. תסתכל אם הסמל סגור או נשאר פתוח.',
      'הקלפים שמתאימים לחוק כולם תחומים בתוך מסגרת, טבעת או צורה שסוגרת אותם.',
    ],
    idlePrompt: 'חוק חדש. הפעם השאלה היא מי סגור ומי נשאר פתוח.',
    incorrectGuessHint:
      'כמעט. החוק כאן קשור לסמל שנסגר בתוך מסגרת או טבעת, לא רק לסידור הפנימי שלו.',
    introEyebrow: 'פרק IV / רשומה 07',
    readyThreshold: 4,
    ruleOptions: [
      {
        id: 'chapter-2-rule-enclosed',
        isCorrect: true,
        label: 'הקלף מתאים לחוק רק אם הסמל סגור בתוך מסגרת, טבעת או צורה מקיפה.',
      },
      {
        id: 'chapter-2-rule-horizontal',
        isCorrect: false,
        label: 'הקלף מתאים לחוק רק אם יש פס אופקי ברור במרכז הסמל.',
      },
      {
        id: 'chapter-2-rule-three-cuts',
        isCorrect: false,
        label: 'הקלף מתאים לחוק רק אם יש שלוש קטיעות קטנות לאורך הצדדים.',
      },
    ],
    successHeading: 'סגרת גם את זה!',
    title: 'חותם הסגירה',
  },
] as const
