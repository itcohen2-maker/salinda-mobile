import type { Card, OverflowSwapPileChoice } from './types';

export const OVERFLOW_SWAP_THRESHOLD = 9;
export const OVERFLOW_SWAP_TIMER_SECONDS = 10;

type BotOverflowSwapChoice = {
  handCardId: string;
  pileChoice: OverflowSwapPileChoice;
};

export function orderHandForFan(cards: readonly Card[]): Card[] {
  const groupOrder: Record<Card['type'], number> = {
    number: 0,
    wild: 0,
    fraction: 1,
    operation: 2,
    salinda: 2,
  };

  return [...cards].sort((a, b) => {
    const ga = groupOrder[a.type] ?? 99;
    const gb = groupOrder[b.type] ?? 99;
    if (ga !== gb) return ga - gb;

    if (a.type === 'number' && b.type === 'number') return (a.value ?? 0) - (b.value ?? 0);
    if (a.type === 'number' && b.type === 'wild') return -1;
    if (a.type === 'wild' && b.type === 'number') return 1;

    if (a.type === 'fraction' && b.type === 'fraction') {
      return (a.fraction ?? '').localeCompare(b.fraction ?? '', 'he');
    }
    if (a.type === 'operation' && b.type === 'operation') {
      return (a.operation ?? '').localeCompare(b.operation ?? '', 'en');
    }
    if (a.type === 'operation' && b.type === 'salinda') return -1;
    if (a.type === 'salinda' && b.type === 'operation') return 1;

    return 0;
  });
}

export function pickOverflowTimeoutHandCardId(hand: readonly Card[]): string | null {
  const ordered = orderHandForFan(hand);
  return ordered.length > 0 ? ordered[ordered.length - 1]!.id : null;
}

function incomingScore(card: Card): number {
  switch (card.type) {
    case 'wild':
      return 500;
    case 'salinda':
      return 400;
    case 'number':
      return 300 + Math.max(0, card.value ?? 0);
    case 'fraction':
      return 200;
    case 'operation':
      return 100;
    default:
      return 0;
  }
}

function outgoingScore(card: Card): number {
  switch (card.type) {
    case 'operation':
      return 500;
    case 'fraction':
      return 400;
    case 'number':
      return 300 + Math.max(0, card.value ?? 0);
    case 'salinda':
      return 200;
    case 'wild':
      return 100;
    default:
      return 0;
  }
}

export function pickBotOverflowSwap(
  hand: readonly Card[],
  topCard: Card | null,
  underTopCard: Card | null,
): BotOverflowSwapChoice | null {
  if (hand.length === 0 || topCard == null) return null;

  const pileCandidates: Array<{
    card: Card;
    pileChoice: OverflowSwapPileChoice;
    topPreference: number;
  }> = [{ card: topCard, pileChoice: 'top', topPreference: 1 }];

  if (underTopCard != null) {
    pileCandidates.push({ card: underTopCard, pileChoice: 'underTop', topPreference: 0 });
  }

  let best:
    | (BotOverflowSwapChoice & {
        incoming: number;
        outgoing: number;
        topPreference: number;
        handIndex: number;
      })
    | null = null;

  for (const [handIndex, handCard] of hand.entries()) {
    const outgoing = outgoingScore(handCard);
    for (const candidate of pileCandidates) {
      const incoming = incomingScore(candidate.card);
      if (
        best == null ||
        incoming > best.incoming ||
        (incoming === best.incoming && outgoing > best.outgoing) ||
        (incoming === best.incoming &&
          outgoing === best.outgoing &&
          candidate.topPreference > best.topPreference) ||
        (incoming === best.incoming &&
          outgoing === best.outgoing &&
          candidate.topPreference === best.topPreference &&
          handIndex < best.handIndex)
      ) {
        best = {
          handCardId: handCard.id,
          pileChoice: candidate.pileChoice,
          incoming,
          outgoing,
          topPreference: candidate.topPreference,
          handIndex,
        };
      }
    }
  }

  if (best == null) return null;
  return {
    handCardId: best.handCardId,
    pileChoice: best.pileChoice,
  };
}
