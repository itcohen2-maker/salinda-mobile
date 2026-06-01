import React from 'react';

import { DiceEquationRound } from './DiceEquationRound';

export default function SpecialCardsIntro({ onDone }: { onDone?: () => void }) {
  return <DiceEquationRound mode="operators" onComplete={onDone} />;
}
