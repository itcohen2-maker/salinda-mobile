// ============================================================
// HandFan — a self-contained, reusable curved hand fan.
//
// A faithful, standalone port of the live game's `SimpleHand` fan
// GEOMETRY (rotation / scale / vertical arc / horizontal spread), built
// on the SAME single source of truth the real fan uses —
// getNativeHandFanMetrics — and rendering cards through the shared
// CardDesign `GameCard`. It deliberately carries NONE of SimpleHand's
// game-state baggage (staging, defense, bot-teaching, tutorialBus): it
// takes a plain card list, scrolls/snaps like the real fan, and reports
// taps. Anchor it at the bottom of a screen to mirror the live hand.
//
// The per-card interpolation constants below are copied verbatim from
// the live SimpleHand so the curve is pixel-identical.
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { GameCard, type Card } from './CardDesign';
import { getNativeHandFanMetrics } from '../src/theme/nativeHandFan';

export interface HandFanProps {
  cards: Card[];
  /** Tapping a card calls this. Omit (or return false from canTap) to
   *  make a card inert. */
  onTapCard?: (card: Card) => void;
  /** Optional per-card tap gate — false renders the card non-tappable. */
  canTap?: (card: Card) => boolean;
  /** Cards whose id is here render with the GameCard "selected" look. */
  selectedIds?: Set<string>;
  /** Width used to horizontally center the fan. Defaults to the screen. */
  width?: number;
}

export default function HandFan({ cards, onTapCard, canTap, selectedIds, width }: HandFanProps) {
  const metrics = useMemo(() => getNativeHandFanMetrics(Platform.OS), []);
  const cardW = metrics.cardWidth;
  const cardH = metrics.cardHeight;
  const renderScale = metrics.renderScale;
  const MAX_ANGLE = metrics.maxAngle;
  const CENTER_SCALE = metrics.centerScale;
  const EDGE_SCALE = metrics.edgeScale;

  const { width: screenW } = useWindowDimensions();
  const fanWidth = width ?? screenW;

  // Box tall enough to fully CONTAIN every card (center card height at
  // CENTER_SCALE + the edge cards' downward arc + the top offset). On
  // Android a child that overflows its parent does not receive touches,
  // so the fan must own enough height for taps on every card to land.
  const fanHeight = Math.ceil(cardH * CENTER_SCALE + cardH * 0.36 + Math.round(cardH * 0.14) + 8);

  const count = cards.length;
  const centerStart = Math.floor(Math.max(0, count - 1) / 2);

  // scrollX is a floating card index: when scrollX === i, card i is centered.
  const scrollX = useRef(new Animated.Value(centerStart)).current;
  const scrollRef = useRef(centerStart);
  const countRef = useRef(count);
  countRef.current = count;
  const cardStepRef = useRef(cardW * 0.62); // px of horizontal travel per card
  cardStepRef.current = cardW * 0.62;

  const [centerIdx, setCenterIdx] = useState(centerStart);
  const centerIdxRef = useRef(centerStart);

  // Keep scrollRef / centerIdx in sync with the animated value.
  useEffect(() => {
    const id = scrollX.addListener(({ value }) => {
      scrollRef.current = value;
      const ci = Math.round(Math.max(0, Math.min(countRef.current - 1, value)));
      if (ci !== centerIdxRef.current) {
        centerIdxRef.current = ci;
        setCenterIdx(ci);
      }
    });
    return () => scrollX.removeListener(id);
  }, [scrollX]);

  // Re-center when the hand identity/size changes (e.g. a fresh round).
  useEffect(() => {
    const target = Math.floor(Math.max(0, count - 1) / 2);
    scrollRef.current = target;
    centerIdxRef.current = target;
    setCenterIdx(target);
    scrollX.setValue(target);
  }, [count, scrollX]);

  // Horizontal drag → scroll; release → spring-snap to the nearest card.
  // onStart stays false so plain taps fall through to each card's button;
  // we only claim the gesture once it is clearly a horizontal drag.
  const startScrollRef = useRef(centerStart);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 0.5,
      onPanResponderGrant: () => {
        startScrollRef.current = scrollRef.current;
      },
      onPanResponderMove: (_e, g) => {
        const next = startScrollRef.current - g.dx / cardStepRef.current;
        scrollX.setValue(Math.max(0, Math.min(countRef.current - 1, next)));
      },
      onPanResponderRelease: () => {
        const target = Math.max(0, Math.min(countRef.current - 1, Math.round(scrollRef.current)));
        Animated.spring(scrollX, { toValue: target, useNativeDriver: true, tension: 60, friction: 10 }).start();
      },
    }),
  ).current;

  return (
    <View style={[styles.viewport, { height: fanHeight, width: fanWidth }]} {...pan.panHandlers}>
      {cards.map((card, i) => {
        const ir = [i - 5, i - 3, i - 2, i - 1, i, i + 1, i + 2, i + 3, i + 5];
        const maxA = MAX_ANGLE;

        const rotateStr = scrollX.interpolate({
          inputRange: ir,
          outputRange: [
            `${-maxA}deg`, `${-maxA}deg`,
            `${-maxA * 0.75}deg`, `${-maxA * 0.35}deg`,
            '0deg',
            `${maxA * 0.35}deg`, `${maxA * 0.75}deg`,
            `${maxA}deg`, `${maxA}deg`,
          ],
        });

        const scale = scrollX.interpolate({
          inputRange: [i - 3, i - 1, i, i + 1, i + 3],
          outputRange: [EDGE_SCALE, EDGE_SCALE + 0.04, CENTER_SCALE, EDGE_SCALE + 0.04, EDGE_SCALE],
          extrapolate: 'clamp',
        });

        const translateX = scrollX.interpolate({
          inputRange: ir,
          outputRange: [
            -cardW * 2.4, -cardW * 1.75, -cardW * 1.2, -cardW * 0.62,
            0,
            cardW * 0.62, cardW * 1.2, cardW * 1.75, cardW * 2.4,
          ],
        });

        const arcY = scrollX.interpolate({
          inputRange: [i - 3, i - 2, i - 1, i, i + 1, i + 2, i + 3],
          outputRange: [
            Math.round(cardH * 0.36), Math.round(cardH * 0.2), Math.round(cardH * 0.07),
            0,
            Math.round(cardH * 0.07), Math.round(cardH * 0.2), Math.round(cardH * 0.36),
          ],
          extrapolate: 'clamp',
        });

        const opacity = scrollX.interpolate({
          inputRange: [i - 4, i - 3, i, i + 3, i + 4],
          outputRange: [0.2, 0.55, 1, 0.55, 0.2],
          extrapolate: 'clamp',
        });

        const distFromCenter = Math.abs(i - centerIdx);
        const zIndex = (count - distFromCenter) * 10 + i;

        const tappable = !!onTapCard && (canTap ? canTap(card) : true);

        return (
          <Animated.View
            key={card.id}
            style={{
              position: 'absolute',
              left: fanWidth / 2 - cardW / 2,
              top: Math.round(cardH * 0.14),
              width: cardW,
              height: cardH,
              opacity,
              zIndex,
              transform: [{ translateX }, { translateY: arcY }, { rotate: rotateStr }, { scale }],
            }}
          >
            <TouchableOpacity
              activeOpacity={tappable ? 0.7 : 1}
              disabled={!tappable}
              onPress={tappable ? () => onTapCard!(card) : undefined}
              style={{ width: cardW, height: cardH, alignItems: 'center', justifyContent: 'center' }}
            >
              <View style={renderScale === 1 ? undefined : { transform: [{ scale: renderScale }] }}>
                <GameCard card={card} selected={selectedIds?.has(card.id)} small onPress={undefined} />
              </View>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { alignSelf: 'center' },
});
