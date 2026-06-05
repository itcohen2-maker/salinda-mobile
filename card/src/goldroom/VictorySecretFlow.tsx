import React, { useState } from 'react';
import { VictorySecretIntroScreen } from './VictorySecretIntroScreen';
import { VictorySecretScenarioRound } from './VictorySecretScenarioRound';

export function VictorySecretFlow({ onExit, onComplete }: { onExit?: () => void; onComplete?: () => void }) {
  const [started, setStarted] = useState(false);

  if (!started) {
    return <VictorySecretIntroScreen onStart={() => setStarted(true)} />;
  }

  return <VictorySecretScenarioRound onExit={onExit} onComplete={onComplete} />;
}
