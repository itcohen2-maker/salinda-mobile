import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { StatusBar } from 'expo-status-bar'
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'

import { ArchiveCard } from './components/ArchiveCard'
import type { PrototypeCard } from './prototypeGame'
import { usePrototypeGame } from './prototypeGame'
import { palette } from './theme'

type ButtonProps = {
  disabled?: boolean
  label: string
  onPress?: () => void
  tone?: 'premium' | 'secondary'
}

function ActionButton({
  disabled,
  label,
  onPress,
  tone = 'secondary',
}: ButtonProps) {
  const isPremium = tone === 'premium'
  const gradientColors: readonly [string, string, string] = isPremium
    ? [palette.emberRed, palette.lacquerRed, palette.deepRed]
    : ['#4E78A0', '#34506F', '#253447']

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionButton,
        isPremium ? styles.premiumButton : styles.secondaryButton,
        disabled ? styles.actionButtonDisabled : null,
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[
          styles.actionButtonFill,
          isPremium ? styles.premiumButtonFill : styles.secondaryButtonFill,
        ]}
      >
        <Text style={styles.actionButtonText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  )
}

function Surface({
  children,
  style,
  tone = 'default',
}: {
  children: React.ReactNode
  style?: object
  tone?: 'default' | 'success' | 'warning'
}) {
  return (
    <View
      style={[
        styles.surface,
        tone === 'success' ? styles.surfaceSuccess : null,
        tone === 'warning' ? styles.surfaceWarning : null,
        style,
      ]}
    >
      {children}
    </View>
  )
}

function Chip({ strong, text }: { strong?: boolean; text: string }) {
  return (
    <View style={[styles.chip, strong ? styles.chipStrong : null]}>
      <Text style={[styles.chipText, strong ? styles.chipTextStrong : null]}>{text}</Text>
    </View>
  )
}

function MiniEvidenceStrip({
  cards,
  empty,
  label,
  state,
}: {
  cards: PrototypeCard[]
  empty: string
  label: string
  state: 'accepted' | 'rejected'
}) {
  return (
    <View style={styles.miniStrip}>
      <Text style={styles.miniStripLabel}>{label}</Text>
      <View style={styles.miniCardsRow}>
        {cards.length > 0 ? (
          cards.slice(0, 4).map((card) => (
            <ArchiveCard
              catalog={card.catalog}
              glyph={card.glyph}
              key={card.id}
              size="evidence"
              state={state}
            />
          ))
        ) : (
          <Text style={styles.emptyText}>{empty}</Text>
        )}
      </View>
    </View>
  )
}

function TopBar({
  chapterCount,
  chapterIndex,
  phaseLabel,
}: {
  chapterCount: number
  chapterIndex: number
  phaseLabel: string
}) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topBarText}>
        <Text style={styles.topBarKicker}>Hidden Rule</Text>
        <Text style={styles.topBarTitle}>ארכיון החוקים</Text>
      </View>
      <View style={styles.topBarChips}>
        <Chip strong text={`פרק ${chapterIndex + 1} מתוך ${chapterCount}`} />
        <Chip text={phaseLabel} />
      </View>
    </View>
  )
}

export function HiddenRuleExpoApp() {
  const game = usePrototypeGame()
  const { height, width } = useWindowDimensions()
  const wide = width > height || width >= 780

  async function handleStartChapter() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    game.actions.startChapter()
  }

  async function handleSelectCard(index: number) {
    await Haptics.selectionAsync()
    game.actions.selectCard(index)
  }

  async function handleTestCard() {
    const willAccept = game.gameplay.selectedCard?.accepted
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    game.actions.testSelectedCard()

    if (willAccept === true) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } else if (willAccept === false) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
  }

  async function handleOpenRuleChoice() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    game.actions.openRuleChoice()
  }

  async function handleRequestHint() {
    await Haptics.selectionAsync()
    game.actions.requestHint()
  }

  async function handleSelectRuleOption(id: string) {
    await Haptics.selectionAsync()
    game.actions.selectRuleOption(id)
  }

  async function handleSubmitRuleChoice() {
    const selectedOption = game.ruleChoice.options.find(
      (option) => option.id === game.ruleChoice.selectedOptionId,
    )
    game.actions.submitRuleChoice()

    await Haptics.notificationAsync(
      selectedOption?.isCorrect
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    )
  }

  async function handleAdvanceChapter() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    if (game.chapterComplete.hasNextChapter) {
      game.actions.advanceChapter()
      return
    }
    game.actions.restartAll()
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#151118', '#251A22', '#182431']}
        end={{ x: 0.85, y: 1 }}
        start={{ x: 0.1, y: 0 }}
        style={styles.appBackground}
      >
        <View style={styles.root}>
          <TopBar
            chapterCount={game.chapterCount}
            chapterIndex={game.chapterIndex}
            phaseLabel={game.phaseLabel}
          />

          {game.screen === 'chapter-intro' ? (
            <View style={[styles.screenBody, wide ? styles.screenBodyWide : null]}>
              <Surface style={[styles.introCard, wide ? styles.introCardWide : null]}>
                <View style={[styles.introLayout, wide ? styles.introLayoutWide : null]}>
                  <View style={styles.introCopy}>
                    <Text style={styles.screenTitle}>{game.chapterIntro.title}</Text>
                    <Text style={styles.promptText}>{game.chapterIntro.brief}</Text>
                    <Text style={styles.goalLine}>{game.chapterIntro.goalLine}</Text>
                    <View style={styles.stepsStack}>
                      <Text style={styles.stepLine}>1. בוחרים קלף.</Text>
                      <Text style={styles.stepLine}>2. בודקים אם הוא עבר או נפסל.</Text>
                      <Text style={styles.stepLine}>3. בוחרים את החוק הנכון.</Text>
                    </View>
                  </View>
                  <View style={styles.introCardWrap}>
                    <ArchiveCard
                      catalog={game.chapterIntro.witnessCard.catalog}
                      glyph={game.chapterIntro.witnessCard.glyph}
                      size="focus"
                      showCatalog={false}
                    />
                  </View>
                </View>
              </Surface>

              <View style={[styles.actionBar, wide ? styles.actionBarWide : null]}>
                <ActionButton
                  label={game.chapterIntro.startLabel}
                  onPress={() => {
                    void handleStartChapter()
                  }}
                  tone="premium"
                />
                <ActionButton label="חזור להתחלה" onPress={game.actions.restartAll} />
              </View>
            </View>
          ) : null}

          {game.screen === 'gameplay' ? (
            <View style={[styles.screenBody, wide ? styles.screenBodyWide : null]}>
              <Surface style={styles.headerSurface}>
                <Text style={styles.screenTitle}>{game.gameplay.title}</Text>
                <Text style={styles.promptText}>{game.gameplay.prompt}</Text>
                {game.gameplay.notice ? (
                  <Text style={styles.inlineNotice}>
                    {game.gameplay.notice.label}: {game.gameplay.notice.body}
                  </Text>
                ) : null}
              </Surface>

              <View style={[styles.playfield, wide ? styles.playfieldWide : null]}>
                <Surface style={[styles.focusSurface, wide ? styles.focusSurfaceWide : null]}>
                  {game.gameplay.focusCard ? (
                    <ArchiveCard
                      catalog={game.gameplay.focusCard.catalog}
                      glyph={game.gameplay.focusCard.glyph}
                      size="focus"
                      state={game.gameplay.focusState}
                    />
                  ) : null}
                  <Text style={styles.focusHelper}>{game.gameplay.focusHelper}</Text>
                </Surface>

                <Surface style={[styles.sideSurface, wide ? styles.sideSurfaceWide : null]}>
                  <Text style={styles.sectionLabel}>מצב הפיצוח</Text>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${(game.gameplay.registerCurrent / game.gameplay.registerTarget) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressLabel}>{game.gameplay.registerStatus}</Text>

                  <View style={styles.statRow}>
                    <Chip strong text={`עברו ${game.gameplay.satisfies.length}`} />
                    <Chip text={`נפסלו ${game.gameplay.contradicts.length}`} />
                    <Chip text={`נותרו ${game.gameplay.remainingCount}`} />
                  </View>

                  <MiniEvidenceStrip
                    cards={game.gameplay.satisfies}
                    empty="עוד אין ראיות שעברו."
                    label="עברו"
                    state="accepted"
                  />
                  <MiniEvidenceStrip
                    cards={game.gameplay.contradicts}
                    empty="עוד אין ראיות שנפסלו."
                    label="נפסלו"
                    state="rejected"
                  />
                </Surface>
              </View>

              <Surface style={styles.handSurface}>
                <View style={styles.handHeader}>
                  <Text style={styles.sectionLabel}>היד שלך</Text>
                  <Text style={styles.handMeta}>בחר קלף אחד לבדיקה</Text>
                </View>
                <View style={styles.handRow}>
                  {game.gameplay.hand.map((card, index) => (
                    <ArchiveCard
                      catalog={card.catalog}
                      glyph={card.glyph}
                      key={card.id}
                      onPress={() => {
                        void handleSelectCard(index)
                      }}
                      showCatalog={false}
                      size="hand"
                      state={game.gameplay.selectedIndex === index ? 'selected' : 'neutral'}
                    />
                  ))}
                </View>
              </Surface>

              <View style={[styles.actionBar, wide ? styles.actionBarWide : null]}>
                {game.gameplay.readyMode ? (
                  <>
                    <ActionButton
                      label="לבחירת החוק"
                      onPress={() => {
                        void handleOpenRuleChoice()
                      }}
                      tone="premium"
                    />
                    <ActionButton
                      label="עוד חקירה"
                      onPress={game.actions.continueInvestigating}
                    />
                  </>
                ) : (
                  <ActionButton
                    disabled={game.gameplay.primaryDisabled}
                    label={game.gameplay.primaryLabel}
                    onPress={
                      game.gameplay.primaryDisabled
                        ? undefined
                        : () => {
                            void handleTestCard()
                          }
                    }
                    tone="premium"
                  />
                )}
                <ActionButton
                  label="קח רמז"
                  onPress={() => {
                    void handleRequestHint()
                  }}
                />
              </View>
            </View>
          ) : null}

          {game.screen === 'rule-choice' ? (
            <View style={[styles.screenBody, wide ? styles.screenBodyWide : null]}>
              <Surface style={styles.headerSurface}>
                <Text style={styles.screenTitle}>{game.ruleChoice.title}</Text>
                <Text style={styles.promptText}>{game.ruleChoice.prompt}</Text>
                {game.ruleChoice.notice ? (
                  <Text style={styles.inlineNotice}>
                    {game.ruleChoice.notice.label}: {game.ruleChoice.notice.body}
                  </Text>
                ) : null}
              </Surface>

              <View style={[styles.choiceBody, wide ? styles.choiceBodyWide : null]}>
                <Surface style={[styles.choiceEvidence, wide ? styles.choiceEvidenceWide : null]}>
                  <Text style={styles.sectionLabel}>הראיות שלך</Text>
                  <View style={styles.choiceWitnessRow}>
                    <ArchiveCard
                      catalog={game.ruleChoice.witnessAccepted.catalog}
                      glyph={game.ruleChoice.witnessAccepted.glyph}
                      size="evidence"
                      state="accepted"
                    />
                    <ArchiveCard
                      catalog={game.ruleChoice.witnessRejected.catalog}
                      glyph={game.ruleChoice.witnessRejected.glyph}
                      size="evidence"
                      state="rejected"
                    />
                  </View>
                  <View style={styles.statRow}>
                    <Chip strong text={`עברו ${game.ruleChoice.counts.satisfies}`} />
                    <Chip text={`נפסלו ${game.ruleChoice.counts.contradicts}`} />
                  </View>
                </Surface>

                <Surface style={styles.choiceOptions}>
                  <Text style={styles.sectionLabel}>איזה חוק מחזיק?</Text>
                  <View style={styles.optionsStack}>
                    {game.ruleChoice.options.map((option) => (
                      <Pressable
                        key={option.id}
                        onPress={() => {
                          void handleSelectRuleOption(option.id)
                        }}
                        style={[
                          styles.optionCard,
                          option.selected ? styles.optionCardSelected : null,
                        ]}
                      >
                        <Text style={styles.optionText}>{option.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </Surface>
              </View>

              <View style={[styles.actionBar, wide ? styles.actionBarWide : null]}>
                <ActionButton
                  disabled={game.ruleChoice.primaryDisabled}
                  label={game.ruleChoice.primaryLabel}
                  onPress={
                    game.ruleChoice.primaryDisabled
                      ? undefined
                      : () => {
                          void handleSubmitRuleChoice()
                        }
                  }
                  tone="premium"
                />
                <ActionButton label="חזור לחקירה" onPress={game.actions.continueInvestigating} />
              </View>
            </View>
          ) : null}

          {game.screen === 'chapter-complete' ? (
            <View style={[styles.screenBody, wide ? styles.screenBodyWide : null]}>
              <Surface style={[styles.completeSurface, wide ? styles.completeSurfaceWide : null]} tone="success">
                <View style={[styles.completeLayout, wide ? styles.completeLayoutWide : null]}>
                  <View style={styles.completeCopy}>
                    <Text style={styles.screenTitle}>{game.chapterComplete.title}</Text>
                    <Text style={styles.promptText}>{game.chapterComplete.message}</Text>
                  </View>
                  <View style={styles.choiceWitnessRow}>
                    <ArchiveCard
                      catalog={game.chapterComplete.witnessAccepted.catalog}
                      glyph={game.chapterComplete.witnessAccepted.glyph}
                      size="evidence"
                      state="accepted"
                    />
                    <ArchiveCard
                      catalog={game.chapterComplete.witnessRejected.catalog}
                      glyph={game.chapterComplete.witnessRejected.glyph}
                      size="evidence"
                      state="rejected"
                    />
                  </View>
                </View>
              </Surface>

              <View style={[styles.actionBar, wide ? styles.actionBarWide : null]}>
                <ActionButton
                  label={game.chapterComplete.nextLabel}
                  onPress={() => {
                    void handleAdvanceChapter()
                  }}
                  tone="premium"
                />
                <ActionButton label="שחק שוב" onPress={game.actions.restartChapter} />
              </View>
            </View>
          ) : null}
        </View>
      </LinearGradient>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  actionBar: {
    flexDirection: 'row-reverse',
    gap: 10,
    minHeight: 58,
  },
  actionBarWide: {
    marginTop: 2,
  },
  actionButton: {
    alignItems: 'stretch',
    borderRadius: 18,
    flex: 1,
    minHeight: 58,
    overflow: 'hidden',
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonFill: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  actionButtonText: {
    color: palette.ivory,
    fontSize: 16,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    textAlign: 'center',
  },
  appBackground: {
    flex: 1,
  },
  chip: {
    backgroundColor: '#24303C',
    borderColor: 'rgba(110, 147, 189, 0.18)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipStrong: {
    backgroundColor: '#4A1E1C',
    borderColor: palette.hotGold,
  },
  chipText: {
    color: palette.softText,
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextStrong: {
    color: palette.ivory,
  },
  choiceBody: {
    flex: 1,
    gap: 10,
  },
  choiceBodyWide: {
    flexDirection: 'row-reverse',
  },
  choiceEvidence: {
    backgroundColor: '#25232A',
    borderColor: 'rgba(240,90,83,0.18)',
    gap: 12,
  },
  choiceEvidenceWide: {
    flex: 0.75,
  },
  choiceOptions: {
    backgroundColor: '#2B2020',
    borderColor: 'rgba(242,200,104,0.24)',
    flex: 1,
    gap: 10,
  },
  choiceWitnessRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 12,
    justifyContent: 'center',
  },
  completeCopy: {
    flex: 1,
    gap: 8,
  },
  completeLayout: {
    gap: 16,
  },
  completeLayoutWide: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
  },
  completeSurface: {
    flex: 1,
    justifyContent: 'center',
  },
  completeSurfaceWide: {
    justifyContent: 'space-between',
  },
  emptyText: {
    color: palette.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },
  focusHelper: {
    color: palette.softText,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
    textAlign: 'center',
  },
  focusSurface: {
    alignItems: 'center',
    backgroundColor: '#2A2430',
    borderColor: 'rgba(240,90,83,0.18)',
    flex: 1,
    justifyContent: 'center',
    minHeight: 230,
  },
  focusSurfaceWide: {
    flex: 0.9,
    minHeight: 0,
  },
  goalLine: {
    color: palette.liveBrass,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 6,
    textAlign: 'right',
  },
  handHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  handMeta: {
    color: palette.mutedText,
    fontSize: 13,
    fontWeight: '600',
  },
  handRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    justifyContent: 'space-between',
    marginTop: 10,
  },
  handSurface: {
    backgroundColor: '#291E1A',
    borderColor: 'rgba(242,200,104,0.24)',
    gap: 6,
  },
  headerSurface: {
    backgroundColor: '#2D2127',
    borderColor: 'rgba(240,90,83,0.2)',
  },
  inlineNotice: {
    color: palette.hotGold,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 8,
    textAlign: 'right',
  },
  introCard: {
    flex: 1,
    justifyContent: 'center',
  },
  introCardWide: {
    justifyContent: 'center',
  },
  introCardWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  introCopy: {
    flex: 1,
    gap: 4,
  },
  introLayout: {
    gap: 18,
  },
  introLayoutWide: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
  },
  miniCardsRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
    minHeight: 92,
  },
  miniStrip: {
    gap: 8,
    marginTop: 10,
  },
  miniStripLabel: {
    color: palette.ivory,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  optionCard: {
    backgroundColor: '#311F20',
    borderColor: 'rgba(242,200,104,0.16)',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionCardSelected: {
    backgroundColor: '#83302E',
    borderColor: palette.hotGold,
  },
  optionText: {
    color: palette.ivory,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'right',
  },
  optionsStack: {
    gap: 10,
  },
  playfield: {
    flex: 1,
    gap: 10,
  },
  playfieldWide: {
    flexDirection: 'row-reverse',
  },
  premiumButton: {
    backgroundColor: palette.deepRed,
    borderColor: palette.hotGold,
    borderWidth: 1,
    shadowColor: palette.emberRed,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
  },
  premiumButtonFill: {
    borderColor: 'rgba(255, 234, 184, 0.3)',
    borderTopWidth: 1,
  },
  progressFill: {
    backgroundColor: palette.emberRed,
    borderRadius: 999,
    height: 10,
  },
  progressLabel: {
    color: palette.softText,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'right',
  },
  progressTrack: {
    backgroundColor: '#322833',
    borderRadius: 999,
    height: 10,
    marginTop: 8,
    overflow: 'hidden',
  },
  promptText: {
    color: palette.ivory,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
    marginTop: 6,
    textAlign: 'right',
  },
  root: {
    flex: 1,
    gap: 10,
    paddingBottom: 12,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  safeArea: {
    backgroundColor: palette.background,
    flex: 1,
  },
  screenBody: {
    flex: 1,
    gap: 10,
  },
  screenBodyWide: {
    gap: 10,
  },
  screenTitle: {
    color: palette.ivory,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'right',
  },
  secondaryButton: {
    backgroundColor: '#31465E',
    borderColor: 'rgba(115,183,255,0.32)',
    borderWidth: 1,
    shadowColor: palette.cyanGlow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  secondaryButtonFill: {
    borderColor: 'rgba(202, 227, 255, 0.18)',
    borderTopWidth: 1,
  },
  sectionLabel: {
    color: palette.ivory,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
  },
  sideSurface: {
    backgroundColor: '#221E24',
    borderColor: 'rgba(240,90,83,0.12)',
    flex: 1,
    justifyContent: 'flex-start',
  },
  sideSurfaceWide: {
    flex: 1.1,
  },
  statRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  stepLine: {
    color: palette.softText,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'right',
  },
  stepsStack: {
    gap: 6,
    marginTop: 10,
  },
  surface: {
    backgroundColor: '#1E2027',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  surfaceSuccess: {
    backgroundColor: '#213128',
    borderColor: 'rgba(117,146,122,0.55)',
  },
  surfaceWarning: {
    backgroundColor: '#332227',
    borderColor: 'rgba(147,82,82,0.55)',
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  topBarChips: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },
  topBarKicker: {
    color: palette.liveBrass,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  topBarText: {
    gap: 2,
  },
  topBarTitle: {
    color: palette.ivory,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'right',
  },
})
