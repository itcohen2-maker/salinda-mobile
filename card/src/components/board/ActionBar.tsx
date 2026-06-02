import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useGame } from '../../hooks/useGame'
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout'
import { useLocale } from '../../i18n/LocaleContext'
import { Operation } from '../../types/game'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import EquationBuilder from './EquationBuilder'

export default function ActionBar() {
  const { state, dispatch } = useGame()
  const { t } = useLocale()
  const responsive = useResponsiveLayout()
  const currentPlayer = state.players[state.currentPlayerIndex]
  if (!currentPlayer) return null

  const isSelectPhase = state.phase === 'select-cards'
  const hasPlayed = state.hasPlayedCards
  const hasActiveOp = isSelectPhase && !!state.activeOperation && !hasPlayed

  const handleSalindaChoice = (op: Operation) => {
    const salindaCard = state.selectedCards[0]
    if (salindaCard) dispatch({ type: 'PLAY_SALINDA', card: salindaCard, chosenOperation: op })
  }
  const buttonRowStyle = responsive.isSingleColumn ? styles.rowStacked : null
  const actionButtonStyle = responsive.isSingleColumn ? styles.fullWidthButton : null
  const salindaGridStyle = responsive.isSingleColumn ? styles.salindaGridStacked : null
  const salindaButtonStyle = responsive.isSingleColumn ? styles.salindaBtnSingleColumn : styles.salindaBtn

  return (
    <View style={styles.container}>
      {/* Operation challenge — info only, counter by tapping cards in hand */}
      {hasActiveOp && (
        <View style={styles.opSection}>
          <Text style={styles.opTitle}>{t('game.opChallenge', { op: state.activeOperation! })}</Text>
          <Text style={styles.opHint}>
            {t('game.opChallengeHint')}
          </Text>
          <View style={[styles.row, buttonRowStyle]}>
            <Button
              testID="action-bar-penalty"
              variant="danger"
              size="sm"
              onPress={() => dispatch({ type: 'END_TURN' })}
              style={actionButtonStyle ?? undefined}
            >
              {t('game.takePenalty')}
            </Button>
          </View>
        </View>
      )}

      {/* Equation Builder + Draw — only when not in operation challenge and haven't played */}
      {isSelectPhase && !hasActiveOp && !hasPlayed && (
        <>
          <EquationBuilder />
          <View style={[styles.row, buttonRowStyle]}>
            <Button
              testID="action-bar-draw"
              variant="secondary"
              onPress={() => dispatch({ type: 'DRAW_CARD' })}
              style={actionButtonStyle ?? undefined}
            >
              {t('game.drawCard')}
            </Button>
          </View>
        </>
      )}

      {/* End Turn (enabled after playing or drawing) */}
      {isSelectPhase && !hasActiveOp && (
        <View style={[styles.row, buttonRowStyle]}>
          {(hasPlayed || state.hasDrawnCard) && (
            <Button
              testID="action-bar-end-turn"
              variant="secondary"
              onPress={() => dispatch({ type: 'END_TURN' })}
              style={actionButtonStyle ?? undefined}
            >
              {t('game.endTurn')}
            </Button>
          )}
        </View>
      )}

      {/* Message */}
      {!!state.message && (
        <View style={styles.message}>
          <Text style={styles.messageText}>{state.message}</Text>
        </View>
      )}

      {/* Salinda modal — opens when player taps a salinda card in their hand */}
      <Modal
        visible={state.salindaModalOpen}
        onClose={() => dispatch({ type: 'CLOSE_SALINDA_MODAL' })}
        title={t('game.pickSalindaOp')}
      >
        <View testID="action-bar-salinda-grid" style={[styles.salindaGrid, salindaGridStyle]}>
          {(['+', '-', 'x', '÷'] as Operation[]).map((op) => (
            <Button
              testID={`action-bar-salinda-${op}`}
              key={op}
              variant="primary"
              size="lg"
              onPress={() => handleSalindaChoice(op)}
              style={salindaButtonStyle}
            >
              {op}
            </Button>
          ))}
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: 10 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  rowStacked: { flexDirection: 'column' },
  opSection: {
    backgroundColor: 'rgba(154,52,18,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
    borderRadius: 10,
    padding: 12,
  },
  opTitle: { color: '#FDBA74', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  opHint: { color: '#9CA3AF', fontSize: 11, marginBottom: 8 },
  message: {
    backgroundColor: 'rgba(234,179,8,0.1)',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  messageText: { color: '#FDE68A', fontSize: 13, textAlign: 'center' },
  salindaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  salindaGridStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  salindaBtn: { width: '45%', minWidth: 100 },
  salindaBtnSingleColumn: { width: '100%' },
  fullWidthButton: { width: '100%' },
})
