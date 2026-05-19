import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { FeedbackExperienceKind } from '../../feedback/promptState';

type SubmitResult = 'opened' | 'fallback';

interface FeedbackMailCardProps {
  email: string;
  isRTL: boolean;
  locale: string;
  promptKind: FeedbackExperienceKind;
  onCopyEmail: () => Promise<void> | void;
  onDismiss: () => void;
  onSubmit: (payload: { rating: number; comment: string }) => Promise<SubmitResult> | SubmitResult;
  dismissLabel?: string;
}

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

function isHebrewLocale(locale: string): boolean {
  return locale === 'he';
}

export function FeedbackMailCard({
  email,
  isRTL,
  locale,
  promptKind,
  onCopyEmail,
  onDismiss,
  onSubmit,
  dismissLabel,
}: FeedbackMailCardProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [showFallback, setShowFallback] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isHebrew = isHebrewLocale(locale);

  useEffect(() => {
    setRating(0);
    setComment('');
    setShowFallback(false);
    setSubmitting(false);
  }, [promptKind]);

  const copy = useMemo(() => {
    if (isHebrew) {
      return {
        badge:
          promptKind === 'tutorial'
            ? 'אחרי ההדרכה'
            : promptKind === 'game'
              ? 'אחרי משחק'
              : 'פידבק לטסטרים',
        title:
          promptKind === 'general'
            ? 'יש משהו שחשוב שנדע?'
            : 'איך הייתה ההתנסות שלך?',
        helper:
          promptKind === 'general'
            ? 'אפשר לשלוח פידבק קצר בכל רגע'
            : 'דירוג קצר ולא מחייב',
        commentPlaceholder: 'רוצה להוסיף משהו קצר?',
        send: 'שלח',
        skip: 'דלג',
        fallbackTitle: 'לא הצלחנו לפתוח טיוטת מייל',
        fallbackBody: 'אפשר להעתיק את הכתובת ולשלוח כשתרצה/י.',
        copyEmail: 'העתק מייל',
      };
    }

    return {
      badge:
        promptKind === 'tutorial'
          ? 'After the tutorial'
          : promptKind === 'game'
            ? 'After your game'
            : 'Tester feedback',
      title:
        promptKind === 'general'
          ? 'Anything we should know?'
          : 'How was your experience?',
      helper:
        promptKind === 'general'
          ? 'You can send quick feedback any time'
          : 'A quick rating is enough',
      commentPlaceholder: 'Want to add a short note?',
      send: 'Send',
      skip: 'Skip',
      fallbackTitle: 'We could not open your mail app',
      fallbackBody: 'You can copy the address and send feedback later.',
      copyEmail: 'Copy email',
    };
  }, [isHebrew, promptKind]);

  const handleSubmit = async () => {
    if (rating < 1 || submitting) return;
    setSubmitting(true);
    try {
      const result = await onSubmit({ rating, comment: comment.trim() });
      if (result === 'fallback') {
        setShowFallback(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View testID="feedback-mail-card" style={styles.shell}>
      <View style={styles.badgeRow}>
        <Text style={styles.badgeText}>{copy.badge}</Text>
      </View>
      <Text
        style={[
          styles.title,
          { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
        ]}
      >
        {copy.title}
      </Text>
      <Text
        style={[
          styles.helper,
          { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
        ]}
      >
        {copy.helper}
      </Text>

      <View style={[styles.starsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {STAR_VALUES.map((value) => {
          const active = rating >= value;
          return (
            <TouchableOpacity
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`${value} star${value > 1 ? 's' : ''}`}
              activeOpacity={0.82}
              onPress={() => setRating(value)}
              style={[styles.starButton, active ? styles.starButtonActive : null]}
            >
              <Text style={[styles.starText, active ? styles.starTextActive : null]}>★</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {rating > 0 ? (
        <View style={styles.formArea}>
          <TextInput
            multiline
            placeholder={copy.commentPlaceholder}
            placeholderTextColor="rgba(191,219,254,0.58)"
            value={comment}
            onChangeText={setComment}
            textAlignVertical="top"
            style={[
              styles.input,
              {
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              },
            ]}
          />
          <TouchableOpacity
            activeOpacity={0.9}
            disabled={submitting}
            onPress={handleSubmit}
            style={[styles.sendButton, submitting ? styles.sendButtonDisabled : null]}
          >
            <Text style={styles.sendButtonText}>{copy.send}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {showFallback ? (
        <View style={styles.fallbackBox}>
          <Text
            style={[
              styles.fallbackTitle,
              { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
            ]}
          >
            {copy.fallbackTitle}
          </Text>
          <Text
            style={[
              styles.fallbackBody,
              { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
            ]}
          >
            {copy.fallbackBody}
          </Text>
          <View style={styles.emailRow}>
            <Text selectable style={styles.emailText}>
              {email}
            </Text>
            <TouchableOpacity activeOpacity={0.88} onPress={onCopyEmail} style={styles.copyButton}>
              <Text style={styles.copyButtonText}>{copy.copyEmail}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <TouchableOpacity activeOpacity={0.82} onPress={onDismiss} style={styles.skipLink}>
        <Text style={styles.skipLinkText}>{dismissLabel ?? copy.skip}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    maxWidth: 420,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(9,23,43,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.28)',
    ...Platform.select({
      ios: {
        shadowColor: '#020617',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.22,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  badgeRow: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(59,130,246,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(125,211,252,0.24)',
  },
  badgeText: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '800',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    marginTop: 12,
  },
  helper: {
    color: 'rgba(226,232,240,0.82)',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 6,
  },
  starsRow: {
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
  },
  starButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.26)',
  },
  starButtonActive: {
    backgroundColor: 'rgba(250,204,21,0.18)',
    borderColor: 'rgba(250,204,21,0.52)',
  },
  starText: {
    color: 'rgba(191,219,254,0.42)',
    fontSize: 24,
    fontWeight: '900',
  },
  starTextActive: {
    color: '#FACC15',
  },
  formArea: {
    marginTop: 14,
    gap: 10,
  },
  input: {
    minHeight: 78,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.24)',
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  sendButton: {
    minHeight: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
  },
  sendButtonDisabled: {
    opacity: 0.65,
  },
  sendButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
  },
  fallbackBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(30,41,59,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
  },
  fallbackTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  fallbackBody: {
    color: 'rgba(226,232,240,0.86)',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    marginTop: 6,
  },
  emailRow: {
    marginTop: 12,
    gap: 10,
    alignItems: 'stretch',
  },
  emailText: {
    color: '#FDE68A',
    fontSize: 14,
    fontWeight: '800',
  },
  copyButton: {
    minHeight: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37,99,235,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.32)',
  },
  copyButtonText: {
    color: '#BFDBFE',
    fontSize: 14,
    fontWeight: '900',
  },
  skipLink: {
    alignSelf: 'center',
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  skipLinkText: {
    color: 'rgba(191,219,254,0.82)',
    fontSize: 13,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
