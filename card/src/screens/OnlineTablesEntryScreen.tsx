import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth, syncTutorialCoins } from '../hooks/useAuth';
import { useMultiplayer } from '../hooks/useMultiplayer';
import type { LobbyTableSummary } from '../../shared/types';
import { useLocale } from '../i18n/LocaleContext';
import SalindaPuzzleGameLogo from '../components/branding/SalindaPuzzleGameLogo';
import { CARDS_PER_PLAYER } from '../../shared/gameConstants';
import TablesLobbyScreen, { pickQuickMatchTable } from './TablesLobbyScreen';
import { LanguageToggle, parseJoinParamsFromUrl } from './OnlineTableScreens';

function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, isRTL } = useLocale();
  const ta = isRTL ? 'right' : 'left';
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.logoWrap}>
            <SalindaPuzzleGameLogo width={220} />
          </View>
          <Text style={styles.modalTitle}>{t('start.rulesTitle')}</Text>
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            <Text style={[styles.rulesSectionTitle, { textAlign: ta }]}>{t('start.goalTitle')}</Text>
            <Text style={[styles.rulesLine, { textAlign: ta }]}>{t('start.rules.goal1', { n: CARDS_PER_PLAYER })}</Text>
            <Text style={[styles.rulesLine, { textAlign: ta }]}>{t('start.rules.goalLimit')}</Text>
            <Text style={[styles.rulesLine, { textAlign: ta }]}>{t('start.rules.goal2')}</Text>
            <Text style={[styles.rulesSectionTitle, { textAlign: ta }]}>{t('start.turnTitle')}</Text>
            <Text style={[styles.rulesLine, { textAlign: ta }]}>{t('start.rules.t1')}</Text>
            <Text style={[styles.rulesLine, { textAlign: ta }]}>{t('start.rules.t2')}</Text>
            <Text style={[styles.rulesLine, { textAlign: ta }]}>{t('start.rules.t3')}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>{t('lobby.rulesModalClose')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function OnlineTablesEntryScreen({
  defaultPlayerName,
  onBackToChoice,
}: {
  defaultPlayerName?: string;
  onBackToChoice?: () => void;
}) {
  const { t } = useLocale();
  const { profile } = useAuth();
  const { connected, createTable, joinTable, joinPrivateTable, refreshTables, tables, error, clearError, setServerUrl } = useMultiplayer();
  const [playerName, setPlayerName] = useState((defaultPlayerName ?? '').slice(0, 7));
  const [codeJoinOpen, setCodeJoinOpen] = useState(false);
  const [codeJoinRoomCode, setCodeJoinRoomCode] = useState('');
  const [codeJoinInviteCode, setCodeJoinInviteCode] = useState('');
  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  useEffect(() => {
    refreshTables();
  }, [refreshTables]);

  useEffect(() => {
    if (!connected) return;
    refreshTables();
    const timer = setInterval(() => refreshTables(), 5000);
    return () => clearInterval(timer);
  }, [connected, refreshTables]);

  useEffect(() => {
    if (error) {
      setIsCreatingTable(false);
      const timer = setTimeout(clearError, 4000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  useEffect(() => {
    if (!isCreatingTable) return;
    const timer = setTimeout(() => setIsCreatingTable(false), 15000);
    return () => clearTimeout(timer);
  }, [isCreatingTable]);

  useEffect(() => {
    const { roomCode, inviteCode, serverUrl, name } = parseJoinParamsFromUrl();
    if (!roomCode) return;
    setCodeJoinRoomCode(roomCode.replace(/\D/g, '').slice(0, 4));
    setCodeJoinInviteCode((inviteCode ?? '').replace(/\D/g, '').slice(0, 6));
    setCodeJoinOpen(true);
    if (name) setPlayerName(name.slice(0, 7));
    if (serverUrl) setServerUrl(serverUrl);
  }, [setServerUrl]);

  useEffect(() => {
    if (playerName.trim().length > 0) return;
    if (!defaultPlayerName) return;
    setPlayerName(defaultPlayerName.slice(0, 7));
  }, [defaultPlayerName, playerName]);

  const handleCreateTable = () => {
    if (!playerName.trim()) return;
    setIsCreatingTable(true);
    createTable(playerName.trim());
  };

  const handleJoinTable = (table: LobbyTableSummary) => {
    if (!playerName.trim()) return;
    if (table.visibility === 'private_locked') {
      setCodeJoinInviteCode('');
      setCodeJoinRoomCode(table.roomCode);
      setCodeJoinOpen(true);
      return;
    }
    joinTable(table.roomCode, playerName.trim());
  };

  const handleQuickMatch = () => {
    if (!playerName.trim()) return;
    const candidate = pickQuickMatchTable(tables);
    if (candidate) {
      joinTable(candidate.roomCode, playerName.trim());
      return;
    }
    setIsCreatingTable(true);
    createTable(playerName.trim());
  };

  const handleSubmitPrivateJoin = () => {
    if (!playerName.trim() || codeJoinRoomCode.length < 4) return;
    if (codeJoinInviteCode.length === 6) {
      joinPrivateTable(codeJoinRoomCode, codeJoinInviteCode, playerName.trim());
      return;
    }
    joinTable(codeJoinRoomCode, playerName.trim());
  };

  const hasPartialInviteCode = codeJoinInviteCode.length > 0 && codeJoinInviteCode.length < 6;

  const handleExitApp = () => {
    void syncTutorialCoins().then(() => BackHandler.exitApp());
  };

  return (
    <>
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <Modal visible={isCreatingTable} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View testID="creating-table-card" style={styles.waitingCard}>
            <View style={styles.waitingSpinnerWrap}>
              <ActivityIndicator size="large" color="#FDE68A" />
            </View>
            <Text style={styles.waitingTitle}>{t('lobby.creatingTableTitle')}</Text>
            <Text style={styles.waitingBody}>{t('lobby.creatingTableBody')}</Text>
          </View>
        </View>
      </Modal>
      <TablesLobbyScreen
        balance={profile?.total_coins ?? 0}
        error={error}
        headerAccessory={<LanguageToggle />}
        onBack={onBackToChoice}
        onCreateTable={handleCreateTable}
        onEnterCode={() => setCodeJoinOpen(true)}
        onExitApp={handleExitApp}
        onJoinTable={handleJoinTable}
        onOpenRules={() => setRulesOpen(true)}
        onPlayerNameChange={setPlayerName}
        onQuickMatch={handleQuickMatch}
        onRefresh={refreshTables}
        playerName={playerName}
        tables={tables}
      />
      <Modal
        visible={codeJoinOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCodeJoinOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.privateJoinCard}>
            <Text style={styles.modalTitle}>{t('lobby.enterCode')}</Text>
            <Text style={styles.fieldLabel}>{t('lobby.roomCode')}</Text>
            <View style={styles.inputShell}>
              <TextInput
                testID="online-code-join-room"
                style={styles.input}
                value={codeJoinRoomCode}
                onChangeText={(value) => setCodeJoinRoomCode(value.replace(/\D/g, '').slice(0, 4))}
                placeholder={t('lobby.roomCode')}
                placeholderTextColor="#94A3B8"
                textAlign="center"
                maxLength={4}
                keyboardType="number-pad"
              />
            </View>
            <Text style={styles.fieldLabel}>{t('lobby.inviteCodeLabel')}</Text>
            <View style={styles.inputShell}>
              <TextInput
                testID="online-code-join-invite"
                style={styles.input}
                value={codeJoinInviteCode}
                onChangeText={(value) => setCodeJoinInviteCode(value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t('lobby.inviteCodePlaceholder')}
                placeholderTextColor="#94A3B8"
                textAlign="center"
                maxLength={6}
                keyboardType="number-pad"
              />
            </View>
            <TouchableOpacity
              testID="online-code-join-submit"
              style={[styles.primaryButton, (!playerName.trim() || codeJoinRoomCode.length < 4 || hasPartialInviteCode) && styles.primaryButtonDisabled]}
              onPress={handleSubmitPrivateJoin}
              disabled={!playerName.trim() || codeJoinRoomCode.length < 4 || hasPartialInviteCode}
            >
              <Text style={styles.primaryButtonText}>{t('lobby.joinTable')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setCodeJoinOpen(false);
              }}
            >
              <Text style={styles.closeButtonText}>{t('lobby.rulesModalClose')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.35)',
    padding: 18,
  },
  waitingCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.35)',
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  waitingSpinnerWrap: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(253,230,138,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  waitingTitle: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  waitingBody: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  rulesSectionTitle: {
    color: '#FCD34D',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 12,
  },
  rulesLine: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
  closeButton: {
    marginTop: 12,
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  privateJoinCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    padding: 18,
  },
  roomCode: {
    color: '#FDE68A',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 10,
  },
  fieldLabel: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 6,
  },
  inputShell: {
    width: '100%',
    backgroundColor: '#D4A010',
    borderRadius: 18,
    padding: 3,
    marginBottom: 8,
  },
  input: {
    width: '100%',
    backgroundColor: '#132238',
    borderWidth: 1,
    borderColor: 'rgba(255,240,180,0.22)',
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
});
