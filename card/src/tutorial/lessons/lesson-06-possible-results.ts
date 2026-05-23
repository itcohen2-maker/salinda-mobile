// ============================================================
// lesson-06-possible-results.ts — Sixth lesson (core): possible
// outcomes button + mini cards + red solve-exercise chip.
//
// Runs on the real game UI (ResultsChip + ResultsStripBelowTable +
// SolveExerciseChip). Two short steps — the old "copy exercise"
// step was dropped; the learner only needs to understand that
// tapping a mini-card reveals the exercise behind it, not rebuild
// it in the EquationBuilder.
//
// 6.1 (open-chip) — the learner taps the green "possible results"
//     chip next to the pile. The strip of mini-cards slides open,
//     then the learner gets a short reading beat explaining that
//     each mini-card is a reachable result.
//     Outcome: `resultsChipTapped` user event.
//
// 6.2 (tap-mini)  — one of the mini-cards pulses; the learner taps
//     it to reveal the red SolveExerciseChip with the full
//     equation behind the chosen result. Celebrate requires a
//     manual "הבנתי" acknowledgement before the lesson advances.
//     Outcome: `miniCardTapped` user event.
// ============================================================

import type { Lesson } from './types';

export const lesson06PossibleResults: Lesson = {
  id: 'possible-results-basics',
  titleKey: 'tutorial.l6.title',
  descKey: 'tutorial.l6.desc',
  steps: [
    {
      id: 'open-chip',
      // Wait long enough so the 140ms TUTORIAL_FORCE_SOLVED rig has committed
      // and the learner has a readable beat before control moves to them.
      // fire before BOT_DEMO_DONE transitions to await-mimic. Without this delay
      // there is a ~140ms window where the equation isn't shown yet on entry.
      botDemo: async (api) => { await api.wait(900); },
      outcome: (e) => e.kind === 'resultsChipTapped',
      hintKey: 'tutorial.l6a.hintTapChip',
      botHintKey: 'tutorial.l6a.hintTapChip',
      celebrateKey: 'tutorial.l6a.celebrate',
    },
    {
      id: 'tap-mini',
      botDemo: async (api) => {
        await api.wait(2600);
        // Bot taps the first mini-card in the strip (sorted by result ascending).
        // The host rigs dice + hand so at least one mini-card is always present.
        // Wait is kept well below the 6 s safety fallback so the tap actually fires.
        await api.tapMiniResult(0);
        // Keep the red solve-exercise chip visible for a readable beat before
        // handing control back to the learner.
        await api.wait(1700);
      },
      outcome: (e) => e.kind === 'l6TapMiniAck',
      hintKey: 'tutorial.l6b.hintTapMini',
      botHintKey: 'tutorial.l6b.botIntro',
      celebrateKey: 'tutorial.l6b.celebrate',
    },
    {
      id: 'wild-finish',
      botDemo: async (api) => {
        // Minimal delay — await-mimic rig sets up TUTORIAL_FORCE_SOLVED
        // with the wild-card hand. No equation building here to avoid
        // confusing the learner about dice vs. multi-play staging.
        await api.wait(400);
      },
      outcome: (e) => e.kind === 'userPlayedCards',
      hintKey: 'tutorial.l6c.hintCopy',
      botHintKey: 'tutorial.l6c.botIntro',
      celebrateKey: 'tutorial.l6c.celebrate',
    },
  ],
};
