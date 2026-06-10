import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useLocale } from '../i18n/LocaleContext';
import { supabase } from '../lib/supabase';
import {
  buildReportCsv,
  downloadTextFile,
  reportFilename,
  type CsvRow,
} from '../utils/reportExport';

interface ReportSummary {
  online_now: number;
  entries_today: number;
  entries_7d: number;
  entries_30d: number;
  total_sessions: number;
  anonymous: number;
  registered: number;
  avg_duration_seconds: number | null;
  total_players: number;
  total_feedback: number;
  by_platform: Record<string, number>;
  by_activity: Record<string, number>;
}

interface PlayerRow {
  id: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  abandons: number;
  total_coins: number;
  created_at: string;
}

interface SessionRow {
  id: string;
  is_anonymous: boolean;
  platform: string;
  session_start: string;
  session_end: string | null;
  event_count: number;
}

interface FeedbackRow {
  id: string;
  username_snapshot: string | null;
  experience_kind: string;
  rating: number;
  comment: string;
  platform: string;
  status: string;
  created_at: string;
}

interface InviteRow {
  email: string;
  status: string;
  first_login_at: string | null;
  last_seen_at: string | null;
}

interface ReportData {
  generated_at: string;
  summary: ReportSummary;
  players: PlayerRow[];
  sessions: SessionRow[];
  feedback: FeedbackRow[];
  invites: InviteRow[];
}

interface Props {
  onBack: () => void;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-GB');
}

function fmtDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return '—';
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (Number.isNaN(ms) || ms < 0) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m === 0 ? `${s}s` : `${m}m ${s % 60}s`;
}

function fmtAvg(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—';
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return m === 0 ? `${s}s` : `${m}m ${s % 60}s`;
}

/** Build a clean standalone HTML doc and open it in a new tab for printing/PDF (web only). */
function openPrintableReport(data: ReportData, title: string, generatedLabel: string) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const esc = (v: unknown) =>
    String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
  const table = (heading: string, cols: string[], rows: Array<Array<unknown>>) => `
    <h2>${esc(heading)}</h2>
    <table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`;
  const s = data.summary;
  const summaryRows: Array<Array<unknown>> = [
    ['Online now', s.online_now],
    ['Entries today', s.entries_today],
    ['Entries 7d', s.entries_7d],
    ['Entries 30d', s.entries_30d],
    ['Total sessions', s.total_sessions],
    ['Registered', s.registered],
    ['Anonymous', s.anonymous],
    ['Avg duration', fmtAvg(s.avg_duration_seconds)],
    ['Total players', s.total_players],
    ['Total feedback', s.total_feedback],
  ];
  const html = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;padding:28px;color:#0f172a}
      h1{font-size:22px;margin:0 0 4px}
      .meta{color:#64748b;font-size:13px;margin-bottom:18px}
      h2{font-size:15px;margin:22px 0 6px;border-bottom:2px solid #e2e8f0;padding-bottom:4px}
      table{border-collapse:collapse;width:100%;font-size:12px;margin-bottom:10px}
      th,td{border:1px solid #e2e8f0;padding:5px 8px;text-align:right}
      th{background:#f1f5f9}
      @media print{body{padding:0}}
    </style></head><body>
    <h1>${esc(title)}</h1>
    <div class="meta">${esc(generatedLabel)}: ${esc(fmtTime(data.generated_at))}</div>
    ${table('Summary', ['Metric', 'Value'], summaryRows)}
    ${table(
      'Players',
      ['Name', 'Rating', 'Wins', 'Losses', 'Coins', 'Joined'],
      data.players.map((p) => [p.username, p.rating, p.wins, p.losses, p.total_coins, fmtTime(p.created_at)]),
    )}
    ${table(
      'Sessions',
      ['Platform', 'Type', 'Date', 'Duration', 'Events'],
      data.sessions.map((x) => [
        x.platform,
        x.is_anonymous ? 'anon' : 'registered',
        fmtTime(x.session_start),
        fmtDuration(x.session_start, x.session_end),
        x.event_count,
      ]),
    )}
    ${table(
      'Feedback',
      ['Name', 'Topic', 'Rating', 'Comment', 'Platform', 'Date'],
      data.feedback.map((f) => [
        f.username_snapshot ?? 'anon',
        f.experience_kind,
        f.rating,
        f.comment,
        f.platform,
        fmtTime(f.created_at),
      ]),
    )}
    ${table(
      'Invitees',
      ['Email', 'Status', 'First login', 'Last seen'],
      data.invites.map((i) => [i.email, i.status, fmtTime(i.first_login_at), fmtTime(i.last_seen_at)]),
    )}
    <script>window.onload=function(){setTimeout(function(){window.print();},300);};</script>
    </body></html>`;
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export function AnalyticsReportScreen({ onBack }: Props) {
  const { t } = useLocale();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data: rpc, error: rpcError } = await supabase.rpc('get_admin_report');
      if (rpcError || !rpc) {
        setError(true);
        return;
      }
      setData(rpc as ReportData);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDownload = useCallback(async () => {
    if (!data) return;
    const sections = [
      {
        title: t('report.sectionPlayers'),
        rows: data.players as unknown as CsvRow[],
        columns: ['username', 'rating', 'wins', 'losses', 'abandons', 'total_coins', 'created_at'],
      },
      {
        title: t('report.sectionSessions'),
        rows: data.sessions as unknown as CsvRow[],
        columns: ['platform', 'is_anonymous', 'session_start', 'session_end', 'event_count'],
      },
      {
        title: t('report.sectionFeedback'),
        rows: data.feedback as unknown as CsvRow[],
        columns: ['username_snapshot', 'experience_kind', 'rating', 'comment', 'platform', 'status', 'created_at'],
      },
      {
        title: t('report.sectionInvites'),
        rows: data.invites as unknown as CsvRow[],
        columns: ['email', 'status', 'first_login_at', 'last_seen_at'],
      },
    ];
    const csv = buildReportCsv(sections);
    const result = await downloadTextFile(reportFilename(new Date(data.generated_at)), csv);
    setToast(
      result === 'downloaded'
        ? t('report.downloaded')
        : result === 'copied'
        ? t('report.copied')
        : t('report.downloadFailed'),
    );
  }, [data, t]);

  const handlePrint = useCallback(() => {
    if (data) openPrintableReport(data, t('report.title'), t('report.generatedAt'));
  }, [data, t]);

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={styles.headerButton} testID="report-back-button">
          <Text style={styles.headerButtonText}>{t('report.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('report.title')}</Text>
        <View style={{ minWidth: 92 }} />
      </View>

      {loading ? (
        <View style={styles.loadingShell}>
          <ActivityIndicator size="large" color="#FACC15" />
          <Text style={styles.loadingText}>{t('report.loading')}</Text>
        </View>
      ) : error || !data ? (
        <View style={styles.centerCard}>
          <Text style={styles.centerBody}>{t('report.error')}</Text>
          <TouchableOpacity onPress={() => void load()} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>{t('analytics.refresh')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={handlePrint} style={styles.actionButton} testID="report-print">
              <Text style={styles.actionButtonText}>{t('report.print')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void handleDownload()}
              style={[styles.actionButton, styles.actionButtonGold]}
              testID="report-download"
            >
              <Text style={[styles.actionButtonText, styles.actionButtonTextGold]}>
                {t('report.downloadCsv')}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.generatedText}>
            {`${t('report.generatedAt')}: ${fmtTime(data.generated_at)}`}
          </Text>
          {toast ? <Text style={styles.toast}>{toast}</Text> : null}

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* Summary */}
            <Text style={styles.sectionTitle}>{t('report.sectionSummary')}</Text>
            <View style={styles.summaryGrid}>
              <Metric label={t('analytics.onlineNow')} value={data.summary.online_now} />
              <Metric label={t('analytics.today')} value={data.summary.entries_today} />
              <Metric label={t('analytics.last7d')} value={data.summary.entries_7d} />
              <Metric label={t('analytics.last30d')} value={data.summary.entries_30d} />
              <Metric label={t('analytics.total')} value={data.summary.total_sessions} />
              <Metric label={t('analytics.registered')} value={data.summary.registered} />
              <Metric label={t('analytics.anonymous')} value={data.summary.anonymous} />
              <Metric label={t('analytics.avgDuration')} value={fmtAvg(data.summary.avg_duration_seconds)} />
              <Metric label={t('report.sectionPlayers')} value={data.summary.total_players} />
              <Metric label={t('report.sectionFeedback')} value={data.summary.total_feedback} />
            </View>

            {/* Players */}
            <ReportTable
              title={`${t('report.sectionPlayers')} (${data.players.length})`}
              headers={[
                t('report.col.username'),
                t('report.col.rating'),
                t('report.col.wins'),
                t('report.col.losses'),
                t('report.col.coins'),
                t('report.col.created'),
              ]}
              rows={data.players.map((p) => [
                p.username,
                String(p.rating),
                String(p.wins),
                String(p.losses),
                String(p.total_coins),
                fmtTime(p.created_at),
              ])}
              emptyText={t('report.empty')}
            />

            {/* Sessions */}
            <ReportTable
              title={`${t('report.sectionSessions')} (${data.sessions.length})`}
              headers={[
                t('report.col.platform'),
                t('report.col.type'),
                t('report.col.date'),
                t('report.col.duration'),
                t('report.col.events'),
              ]}
              rows={data.sessions.map((x) => [
                x.platform,
                x.is_anonymous ? t('analytics.badgeAnonymous') : t('analytics.badgeRegistered'),
                fmtTime(x.session_start),
                fmtDuration(x.session_start, x.session_end),
                String(x.event_count),
              ])}
              emptyText={t('report.empty')}
            />

            {/* Feedback */}
            <ReportTable
              title={`${t('report.sectionFeedback')} (${data.feedback.length})`}
              headers={[
                t('report.col.username'),
                t('report.col.kind'),
                t('report.col.rating'),
                t('report.col.comment'),
                t('report.col.date'),
              ]}
              rows={data.feedback.map((f) => [
                f.username_snapshot ?? t('analytics.badgeAnonymous'),
                f.experience_kind,
                String(f.rating),
                f.comment,
                fmtTime(f.created_at),
              ])}
              emptyText={t('report.empty')}
            />

            {/* Invitees */}
            <ReportTable
              title={`${t('report.sectionInvites')} (${data.invites.length})`}
              headers={[
                t('report.col.email'),
                t('report.col.status'),
                t('report.col.date'),
              ]}
              rows={data.invites.map((i) => [
                i.email,
                i.status,
                fmtTime(i.last_seen_at),
              ])}
              emptyText={t('report.empty')}
            />
          </ScrollView>
        </>
      )}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metricChip}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ReportTable({
  title,
  headers,
  rows,
  emptyText,
}: {
  title: string;
  headers: string[];
  rows: string[][];
  emptyText: string;
}) {
  return (
    <View style={styles.tableBlock}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[styles.tableRow, styles.tableHeaderRow]}>
            {headers.map((h, i) => (
              <Text key={i} style={[styles.tableCell, styles.tableHeaderCell]}>
                {h}
              </Text>
            ))}
          </View>
          {rows.length === 0 ? (
            <Text style={styles.tableEmpty}>{emptyText}</Text>
          ) : (
            rows.map((row, ri) => (
              <View key={ri} style={[styles.tableRow, ri % 2 === 1 && styles.tableRowAlt]}>
                {row.map((cell, ci) => (
                  <Text key={ci} style={styles.tableCell} numberOfLines={2}>
                    {cell}
                  </Text>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0A1628',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerButton: {
    minWidth: 92,
    minHeight: 40,
    borderRadius: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37,99,235,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.34)',
  },
  headerButtonText: {
    color: '#BFDBFE',
    fontSize: 13,
    fontWeight: '800',
  },
  headerTitle: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 16,
  },
  actionButton: {
    minHeight: 44,
    borderRadius: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37,99,235,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.34)',
    marginTop: 12,
  },
  actionButtonGold: {
    backgroundColor: 'rgba(250,204,21,0.16)',
    borderColor: 'rgba(250,204,21,0.5)',
  },
  actionButtonText: {
    color: '#BFDBFE',
    fontSize: 14,
    fontWeight: '800',
  },
  actionButtonTextGold: {
    color: '#FDE68A',
  },
  generatedText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 10,
  },
  toast: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    marginTop: 8,
  },
  body: {
    flex: 1,
    marginTop: 8,
  },
  bodyContent: {
    paddingBottom: 28,
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 8,
    textAlign: 'right',
  },
  summaryGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricChip: {
    minWidth: 88,
    flexGrow: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    alignItems: 'center',
  },
  metricValue: {
    color: '#FACC15',
    fontSize: 18,
    fontWeight: '900',
  },
  metricLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  tableBlock: {
    marginTop: 6,
  },
  tableRow: {
    flexDirection: 'row-reverse',
  },
  tableHeaderRow: {
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(148,163,184,0.34)',
  },
  tableRowAlt: {
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  tableCell: {
    width: 130,
    paddingHorizontal: 8,
    paddingVertical: 8,
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  tableHeaderCell: {
    color: '#FACC15',
    fontWeight: '900',
  },
  tableEmpty: {
    color: '#64748B',
    fontSize: 12,
    paddingVertical: 12,
    textAlign: 'right',
  },
  loadingShell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  centerCard: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 20,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  centerBody: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
