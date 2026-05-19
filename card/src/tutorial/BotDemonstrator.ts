// ============================================================
// BotDemonstrator.ts - High-level API for choreographing bot
// demos in the watch-and-mimic tutorial. Lessons author code
// against this; underneath it talks to tutorialBus.
// ============================================================

import { Audio } from 'expo-av';

import { playTutorialCardSelectSfx } from '../audio/cardSelect';
import { playSfx, isSfxMuted } from '../audio/sfx';
import { getAudioLoadStatus, getAudioReplayStatus } from '../audio/playbackStatus';
import { tutorialBus, type FanDemoEasing } from './tutorialBus';

const diceRollAsset = require('../../assets/dice_roll.mp3');

async function playTutorialCardSelectSound(): Promise<void> {
  await playTutorialCardSelectSfx();
}

export type ScrollOpts = {
  durationMs?: number;
  easing?: FanDemoEasing;
};

export type DemoApi = {
  scrollFanTo(idx: number, opts?: ScrollOpts): Promise<void>;
  pulseCard(idx: number, durationMs?: number): Promise<void>;
  pulseDiceBtn(durationMs?: number): Promise<void>;
  eqPickDice(idx: number): Promise<void>;
  eqSetOp(which: 1 | 2, op: '+' | '-' | 'x' | '÷'): Promise<void>;
  eqConfirm(): Promise<void>;
  eqReset(): Promise<void>;
  stageCardByValue(value: number): Promise<void>;
  wait(ms: number): Promise<void>;
  fanLength(): number;
  l4Config(): { pickA: number; pickB: number; target: number; hand?: number[]; validSums?: number[] } | null;
  openResultsChip(): Promise<void>;
  tapMiniResult(idx: number): Promise<void>;
  l6CopyConfig(): { pickA: number; pickB: number; op: '+' | '-' | 'x' | '÷'; target: number } | null;
  l11Config(): { addA: number; addB: number; target: number } | null;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_SCROLL_MS = 700;
const DEFAULT_PULSE_MS = 600;

export function createBotDemonstrator(isCancelled?: () => boolean): DemoApi {
  const cancelled = (): boolean => isCancelled?.() ?? false;

  return {
    async scrollFanTo(idx: number, opts: ScrollOpts = {}): Promise<void> {
      if (cancelled()) return;
      const durationMs = opts.durationMs ?? DEFAULT_SCROLL_MS;
      tutorialBus.emitFanDemo({ kind: 'scrollToIdx', idx, durationMs, easing: opts.easing });
      await sleep(durationMs);
    },

    async pulseCard(idx: number, durationMs: number = DEFAULT_PULSE_MS): Promise<void> {
      if (cancelled()) return;
      tutorialBus.emitFanDemo({ kind: 'pulseCardIdx', idx, durationMs });
      await sleep(durationMs);
    },

    async pulseDiceBtn(durationMs: number = 1800): Promise<void> {
      if (cancelled()) return;
      tutorialBus.emitFanDemo({ kind: 'pulseDiceBtn', durationMs });

      if (!isSfxMuted()) {
        try {
          const { sound } = await Audio.Sound.createAsync(diceRollAsset, getAudioLoadStatus());
          if (isSfxMuted()) {
            sound.unloadAsync().catch(() => {});
          } else {
            await sound.replayAsync(getAudioReplayStatus());
            sound.setOnPlaybackStatusUpdate((status) => {
              if ((status as { didJustFinish?: boolean }).didJustFinish) {
                sound.unloadAsync().catch(() => {});
              }
            });
          }
        } catch {
          // Fail silently if the dice-roll asset is unavailable.
        }
      }

      await sleep(durationMs);
    },

    async eqPickDice(idx: number): Promise<void> {
      if (cancelled()) return;
      tutorialBus.emitFanDemo({ kind: 'eqPickDice', idx });
      void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.26 });
      await sleep(450);
    },

    async eqSetOp(which: 1 | 2, op: '+' | '-' | 'x' | '÷'): Promise<void> {
      if (cancelled()) return;
      tutorialBus.emitFanDemo({ kind: 'eqSetOp', which, op });
      void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.22 });
      await sleep(450);
    },

    async eqConfirm(): Promise<void> {
      if (cancelled()) return;
      tutorialBus.emitFanDemo({ kind: 'eqConfirm' });
      void playSfx('success', { cooldownMs: 80, volumeOverride: 0.4 });
      await sleep(700);
    },

    async eqReset(): Promise<void> {
      if (cancelled()) return;
      tutorialBus.emitFanDemo({ kind: 'clearCardFrame' });
      tutorialBus.emitFanDemo({ kind: 'eqReset' });
      await sleep(250);
    },

    async stageCardByValue(value: number): Promise<void> {
      if (cancelled()) return;
      tutorialBus.emitFanDemo({ kind: 'stageCardByValue', value });
      void playTutorialCardSelectSound();
      await sleep(500);
    },

    async wait(ms: number): Promise<void> {
      await sleep(ms);
    },

    fanLength(): number {
      return tutorialBus.getFanLength();
    },

    l4Config(): { pickA: number; pickB: number; target: number } | null {
      return tutorialBus.getL4Config();
    },

    async openResultsChip(): Promise<void> {
      if (cancelled()) return;
      tutorialBus.emitFanDemo({ kind: 'openResultsChip' });
      void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.26 });
      await sleep(650);
    },

    async tapMiniResult(idx: number): Promise<void> {
      if (cancelled()) return;
      tutorialBus.emitFanDemo({ kind: 'tapMiniResult', idx });
      void playSfx('tap', { cooldownMs: 0, volumeOverride: 0.26 });
      await sleep(650);
    },

    l6CopyConfig(): { pickA: number; pickB: number; op: '+' | '-' | 'x' | '÷'; target: number } | null {
      return tutorialBus.getL6CopyConfig();
    },

    l11Config(): { addA: number; addB: number; target: number } | null {
      return tutorialBus.getL11Config();
    },
  };
}
