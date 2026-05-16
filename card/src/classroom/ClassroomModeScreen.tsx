import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type {
  ClassroomGroupSnapshot,
  ClassroomInterventionKind,
  ClassroomLaunchConfig,
  ClassroomLiveSettings,
  ClassroomRoleAssignment,
  ClassroomTaskTemplate,
  ConceptFocus,
  DifficultyBand,
  GradeBand,
} from '../../shared/types';
import { brand } from '../theme/brand';
import { useLocale } from '../i18n/LocaleContext';
import { useMultiplayer } from '../hooks/useMultiplayer';

type Props = {
  onBack: () => void;
  preferredName: string;
  onPreferredNameChange: (name: string) => void;
  onLaunchPractice: (config: ClassroomLaunchConfig) => void;
};

const copy = {
  he: {
    title: 'Class Session',
    subtitle: 'מצב כיתתי לפיילוט תגבור: המורה פותח סשן, התלמידים מצטרפים לקבוצות, והדשבורד מציג התקדמות והתערבויות בזמן אמת.',
    back: 'חזרה',
    teacher: 'מורה',
    student: 'תלמידים',
    teacherSetup: 'פתיחת סשן כיתתי',
    teacherName: 'שם המורה',
    sessionTitle: 'כותרת הסשן',
    className: 'שם הכיתה',
    schoolName: 'בית הספר',
    gradeBand: 'שכבה',
    taskTemplate: 'תבנית משימה',
    difficultyBand: 'מסלול',
    conceptFocus: 'מוקד למידה',
    duration: 'משך',
    groupSize: 'גודל קבוצה',
    groupCount: 'מספר קבוצות',
    fractions: 'הפעל שברים',
    createSession: 'פתח סשן כיתתי',
    teacherDashboard: 'דשבורד מורה',
    sessionCode: 'קוד כיתה',
    joinHint: 'שתפו עם התלמידים: קוד כיתה, קוד קבוצה וכינוי קצר.',
    closeSession: 'סיים סשן והפק דוח',
    leaveSession: 'צא מהסשן',
    studentJoin: 'הצטרפות תלמידים',
    nickname: 'כינוי קצר',
    groupCode: 'קוד קבוצה',
    joinSession: 'הצטרף לקבוצה',
    currentRoles: 'תפקידי הסבב',
    launchPractice: 'התחל פעילות סלינדה',
    stuck: 'אנחנו תקועים',
    finishRound: 'סיימנו סבב',
    finishSession: 'סיימנו פעילות',
    liveHint: 'רמז חי',
    recommended: 'המלצה',
    groupStatus: 'סטטוס',
    members: 'חברי הקבוצה',
    interventions: 'התערבות מורה',
    lower: 'הורד קושי',
    raise: 'העלה קושי',
    hint: 'שלח רמז',
    remedial: 'סבב תגבור',
    challenge: 'סבב אתגר',
    freeze: 'הקפא סבב',
    regroup: 'קבץ מחדש לסשן הבא',
    report: 'דוח סיום',
    noReport: 'דוח הסיום יופיע כאן בסיום הסשן.',
    salesTitle: 'חבילת ריטיינר חודשית',
    salesItems: [
      'שימוש כיתתי פעיל ודשבורד מורה',
      'דוח כיתתי ודוח חודשי',
      'עדכוני תוכן ורמות',
      'תמיכה והטמעה למורים',
    ],
    focus_add_sub: 'חיבור וחיסור',
    focus_mul_div: 'כפל וחילוק',
    focus_fractions: 'שברים',
    focus_mixed: 'חזרה משולבת',
    task_warmup: 'פתיח',
    task_remedial: 'תגבור',
    task_fluency_race: 'מרוץ שטף',
    task_mixed_review: 'חזרה מעורבת',
    band_support: 'Support',
    band_core: 'Core',
    band_bridge: 'Bridge',
    band_challenge: 'Challenge',
    status_active: 'פעילה',
    status_stuck: 'תקועה',
    status_finished: 'סיימה',
    status_inactive: 'לא פעילה',
    role_roller: 'Roller',
    role_solver: 'Solver',
    role_checker: 'Checker',
    role_reporter: 'Reporter',
    accuracy: 'דיוק',
    completion: 'השלמה',
    rounds: 'סבבים',
    hints: 'רמזים',
  },
  en: {
    title: 'Class Session',
    subtitle: 'Teacher-led classroom pilot: launch grouped practice, monitor live progress, and intervene without leaving the session.',
    back: 'Back',
    teacher: 'Teacher',
    student: 'Student',
    teacherSetup: 'Open a classroom session',
    teacherName: 'Teacher name',
    sessionTitle: 'Session title',
    className: 'Class name',
    schoolName: 'School',
    gradeBand: 'Grade band',
    taskTemplate: 'Task template',
    difficultyBand: 'Track',
    conceptFocus: 'Learning focus',
    duration: 'Duration',
    groupSize: 'Group size',
    groupCount: 'Groups',
    fractions: 'Enable fractions',
    createSession: 'Create class session',
    teacherDashboard: 'Teacher dashboard',
    sessionCode: 'Class code',
    joinHint: 'Share the class code, a group code, and a short nickname with learners.',
    closeSession: 'Close session and export report',
    leaveSession: 'Leave session',
    studentJoin: 'Student join',
    nickname: 'Nickname',
    groupCode: 'Group code',
    joinSession: 'Join group',
    currentRoles: 'Round roles',
    launchPractice: 'Launch Salinda practice',
    stuck: 'We are stuck',
    finishRound: 'Round complete',
    finishSession: 'Session complete',
    liveHint: 'Live hint',
    recommended: 'Recommendation',
    groupStatus: 'Status',
    members: 'Members',
    interventions: 'Teacher intervention',
    lower: 'Lower',
    raise: 'Raise',
    hint: 'Hint',
    remedial: 'Remedial',
    challenge: 'Challenge',
    freeze: 'Freeze',
    regroup: 'Regroup later',
    report: 'Session report',
    noReport: 'The session report will appear here once the class session ends.',
    salesTitle: 'Monthly retainer package',
    salesItems: [
      'Live classroom usage with teacher dashboard',
      'Class and monthly reporting',
      'Content and level updates',
      'Teacher onboarding and support',
    ],
    focus_add_sub: 'Addition and subtraction',
    focus_mul_div: 'Multiplication and division',
    focus_fractions: 'Fractions',
    focus_mixed: 'Mixed review',
    task_warmup: 'Warmup',
    task_remedial: 'Remedial',
    task_fluency_race: 'Fluency Race',
    task_mixed_review: 'Mixed Review',
    band_support: 'Support',
    band_core: 'Core',
    band_bridge: 'Bridge',
    band_challenge: 'Challenge',
    status_active: 'Active',
    status_stuck: 'Stuck',
    status_finished: 'Finished',
    status_inactive: 'Inactive',
    role_roller: 'Roller',
    role_solver: 'Solver',
    role_checker: 'Checker',
    role_reporter: 'Reporter',
    accuracy: 'Accuracy',
    completion: 'Completion',
    rounds: 'Rounds',
    hints: 'Hints',
  },
} as const;

const gradeOptions: GradeBand[] = ['g3', 'g4', 'g5', 'g6'];
const difficultyOptions: DifficultyBand[] = ['support', 'core', 'bridge', 'challenge'];
const taskOptions: ClassroomTaskTemplate[] = ['warmup', 'remedial', 'fluency_race', 'mixed_review'];
const focusOptions: ConceptFocus[] = ['add_sub', 'mul_div', 'fractions', 'mixed'];
const groupSizeOptions = ['3', '4', '5'] as const;
const interventionOptions: ClassroomInterventionKind[] = [
  'lower_difficulty',
  'raise_difficulty',
  'send_hint',
  'open_remedial_round',
  'open_challenge_round',
  'freeze_round',
  'regroup_next_session',
];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ChipRow<T extends string>({
  value,
  options,
  onChange,
  renderLabel,
}: {
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
  renderLabel: (key: T) => string;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <TouchableOpacity
            key={option}
            style={[styles.chip, selected && styles.chipActive]}
            onPress={() => onChange(option)}
          >
            <Text style={[styles.chipText, selected && styles.chipTextActive]}>{renderLabel(option)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={brand.textMuted}
        style={styles.input}
      />
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.actionBtn,
        tone === 'primary' ? styles.actionPrimary : tone === 'danger' ? styles.actionDanger : styles.actionSecondary,
      ]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function buildHint(group: ClassroomGroupSnapshot, locale: 'he' | 'en'): string {
  if (group.conceptFocus === 'mul_div') {
    return locale === 'he'
      ? 'בדקו אם כפל או חילוק מקרבים אתכם למספר היעד.'
      : 'Check whether multiplication or division gets you closer to the target.';
  }
  if (group.conceptFocus === 'fractions') {
    return locale === 'he'
      ? 'חפשו שבר שמתאים למספר היעד או לערימת ההגנה.'
      : 'Look for a fraction that matches the target or the defense pile.';
  }
  return locale === 'he'
    ? 'התחילו מהמספר הגדול ובדקו איזו פעולה מצמצמת את הפער.'
    : 'Start from the largest number and test the operation that closes the gap.';
}

function bandLabel(band: DifficultyBand, text: typeof copy.he | typeof copy.en): string {
  switch (band) {
    case 'support':
      return text.band_support;
    case 'core':
      return text.band_core;
    case 'bridge':
      return text.band_bridge;
    case 'challenge':
      return text.band_challenge;
  }
}

function taskLabel(task: ClassroomTaskTemplate, text: typeof copy.he | typeof copy.en): string {
  switch (task) {
    case 'warmup':
      return text.task_warmup;
    case 'remedial':
      return text.task_remedial;
    case 'fluency_race':
      return text.task_fluency_race;
    case 'mixed_review':
      return text.task_mixed_review;
  }
}

function focusLabel(focus: ConceptFocus, text: typeof copy.he | typeof copy.en): string {
  switch (focus) {
    case 'add_sub':
      return text.focus_add_sub;
    case 'mul_div':
      return text.focus_mul_div;
    case 'fractions':
      return text.focus_fractions;
    case 'mixed':
      return text.focus_mixed;
  }
}

function statusLabel(status: ClassroomGroupSnapshot['status'], text: typeof copy.he | typeof copy.en): string {
  switch (status) {
    case 'active':
      return text.status_active;
    case 'stuck':
      return text.status_stuck;
    case 'finished':
      return text.status_finished;
    case 'inactive':
      return text.status_inactive;
  }
}

function roleLabel(role: ClassroomRoleAssignment['role'], text: typeof copy.he | typeof copy.en): string {
  switch (role) {
    case 'roller':
      return text.role_roller;
    case 'solver':
      return text.role_solver;
    case 'checker':
      return text.role_checker;
    case 'reporter':
      return text.role_reporter;
  }
}

function interventionLabel(kind: ClassroomInterventionKind, text: typeof copy.he | typeof copy.en): string {
  switch (kind) {
    case 'lower_difficulty':
      return text.lower;
    case 'raise_difficulty':
      return text.raise;
    case 'send_hint':
      return text.hint;
    case 'open_remedial_round':
      return text.remedial;
    case 'open_challenge_round':
      return text.challenge;
    case 'freeze_round':
      return text.freeze;
    case 'regroup_next_session':
      return text.regroup;
  }
}

function operationLabel(operator: string): string {
  if (operator === '+') return '+';
  if (operator === '-') return '-';
  if (operator === 'x') return '×';
  return '÷';
}

export function ClassroomModeScreen({
  onBack,
  preferredName,
  onPreferredNameChange,
  onLaunchPractice,
}: Props) {
  const { locale } = useLocale();
  const uiLocale = locale === 'en' ? 'en' : 'he';
  const text = copy[uiLocale];
  const mp = useMultiplayer();
  const [entryMode, setEntryMode] = useState<'teacher' | 'student'>('teacher');
  const [teacherName, setTeacherName] = useState(preferredName || '');
  const [studentNickname, setStudentNickname] = useState(preferredName || '');
  const [title, setTitle] = useState('תגבור סלינדה');
  const [className, setClassName] = useState('כיתה ד1');
  const [schoolName, setSchoolName] = useState('בית ספר לדוגמה');
  const [gradeBand, setGradeBand] = useState<GradeBand>('g4');
  const [difficultyBand, setDifficultyBand] = useState<DifficultyBand>('support');
  const [taskTemplate, setTaskTemplate] = useState<ClassroomTaskTemplate>('warmup');
  const [conceptFocus, setConceptFocus] = useState<ConceptFocus>('add_sub');
  const [durationMinutes, setDurationMinutes] = useState('12');
  const [groupSize, setGroupSize] = useState<(typeof groupSizeOptions)[number]>('4');
  const [groupCount, setGroupCount] = useState('4');
  const [allowFractions, setAllowFractions] = useState(false);
  const [sessionCode, setSessionCode] = useState('');
  const [groupCode, setGroupCode] = useState('G1');

  const teacherView = mp.classroomState?.teacherView;
  const studentView = mp.classroomState?.studentView;
  const separator = ' • ';
  const emptyValue = '—';

  const sessionSettings = useMemo<ClassroomLiveSettings>(() => ({
    sessionMode: 'class_live',
    title,
    className,
    schoolName,
    gradeBand,
    difficultyBand,
    conceptFocus,
    taskTemplate,
    durationMinutes: Number(durationMinutes) || 12,
    groupSize: Number(groupSize) as 3 | 4 | 5,
    groupCount: Number(groupCount) || 4,
    allowFractions,
  }), [
    allowFractions,
    className,
    conceptFocus,
    difficultyBand,
    durationMinutes,
    gradeBand,
    groupCount,
    groupSize,
    schoolName,
    taskTemplate,
    title,
  ]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topBar}>
          <ActionButton label={text.back} onPress={onBack} tone="secondary" />
          <Text style={styles.headerTitle}>{text.title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.subtitle}>{text.subtitle}</Text>

        {!teacherView && !studentView && (
          <SectionCard title={text.title}>
            <ChipRow
              value={entryMode}
              options={['teacher', 'student'] as const}
              onChange={setEntryMode}
              renderLabel={(value) => (value === 'teacher' ? text.teacher : text.student)}
            />
          </SectionCard>
        )}

        {!teacherView && !studentView && entryMode === 'teacher' && (
          <SectionCard title={text.teacherSetup}>
            <Field
              label={text.teacherName}
              value={teacherName}
              onChangeText={(value) => {
                setTeacherName(value);
                onPreferredNameChange(value.slice(0, 12));
              }}
              placeholder={text.teacherName}
            />
            <Field label={text.sessionTitle} value={title} onChangeText={setTitle} placeholder={text.sessionTitle} />
            <Field label={text.className} value={className} onChangeText={setClassName} placeholder={text.className} />
            <Field label={text.schoolName} value={schoolName} onChangeText={setSchoolName} placeholder={text.schoolName} />

            <Text style={styles.fieldLabel}>{text.gradeBand}</Text>
            <ChipRow value={gradeBand} options={gradeOptions} onChange={setGradeBand} renderLabel={(value) => value.toUpperCase()} />

            <Text style={styles.fieldLabel}>{text.taskTemplate}</Text>
            <ChipRow value={taskTemplate} options={taskOptions} onChange={setTaskTemplate} renderLabel={(value) => taskLabel(value, text)} />

            <Text style={styles.fieldLabel}>{text.difficultyBand}</Text>
            <ChipRow value={difficultyBand} options={difficultyOptions} onChange={setDifficultyBand} renderLabel={(value) => bandLabel(value, text)} />

            <Text style={styles.fieldLabel}>{text.conceptFocus}</Text>
            <ChipRow value={conceptFocus} options={focusOptions} onChange={setConceptFocus} renderLabel={(value) => focusLabel(value, text)} />

            <View style={styles.inlineFields}>
              <View style={styles.inlineField}>
                <Field label={text.duration} value={durationMinutes} onChangeText={setDurationMinutes} placeholder="12" />
              </View>
              <View style={styles.inlineField}>
                <Text style={styles.fieldLabel}>{text.groupSize}</Text>
                <ChipRow value={groupSize} options={groupSizeOptions} onChange={setGroupSize} renderLabel={(value) => value} />
              </View>
            </View>

            <Field label={text.groupCount} value={groupCount} onChangeText={setGroupCount} placeholder="4" />

            <TouchableOpacity style={styles.checkboxRow} onPress={() => setAllowFractions((prev) => !prev)}>
              <View style={[styles.checkbox, allowFractions && styles.checkboxActive]} />
              <Text style={styles.checkboxLabel}>{text.fractions}</Text>
            </TouchableOpacity>

            <ActionButton
              label={text.createSession}
              onPress={() => mp.createClassSession({ teacherName, settings: sessionSettings })}
            />
          </SectionCard>
        )}

        {!teacherView && !studentView && entryMode === 'student' && (
          <SectionCard title={text.studentJoin}>
            <Field
              label={text.nickname}
              value={studentNickname}
              onChangeText={(value) => {
                setStudentNickname(value);
                onPreferredNameChange(value.slice(0, 12));
              }}
              placeholder={text.nickname}
            />
            <Field label={text.sessionCode} value={sessionCode} onChangeText={setSessionCode} placeholder="123456" />
            <Field label={text.groupCode} value={groupCode} onChangeText={(value) => setGroupCode(value.toUpperCase())} placeholder="G1" />
            <ActionButton
              label={text.joinSession}
              onPress={() => mp.joinClassSession({ sessionCode, groupCode, nickname: studentNickname })}
            />
          </SectionCard>
        )}

        {teacherView && (
          <>
            <SectionCard title={text.teacherDashboard}>
              <Text style={styles.metricHeadline}>{teacherView.settings.title}</Text>
              <Text style={styles.smallMeta}>{`${teacherView.settings.className}${separator}${teacherView.settings.gradeBand.toUpperCase()}`}</Text>
              <Text style={styles.codeValue}>{`${text.sessionCode}: ${teacherView.sessionCode}`}</Text>
              <Text style={styles.smallMeta}>{text.joinHint}</Text>
              <View style={styles.kpiRow}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiValue}>{teacherView.kpis.activeGroups}</Text>
                  <Text style={styles.kpiLabel}>{text.status_active}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiValue}>{teacherView.kpis.stuckGroups}</Text>
                  <Text style={styles.kpiLabel}>{text.status_stuck}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiValue}>{teacherView.kpis.averageAccuracy}%</Text>
                  <Text style={styles.kpiLabel}>{text.accuracy}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiValue}>{teacherView.kpis.totalHintsUsed}</Text>
                  <Text style={styles.kpiLabel}>{text.hints}</Text>
                </View>
              </View>
              <Text style={styles.recommendationLabel}>{text.recommended}</Text>
              <Text style={styles.recommendationBody}>{teacherView.recommendedNextStep}</Text>
            </SectionCard>

            {teacherView.groups.map((group) => (
              <SectionCard key={group.groupCode} title={`${group.displayName}${separator}${group.groupCode}`}>
                <Text style={styles.groupMeta}>
                  {`${text.groupStatus}: ${statusLabel(group.status, text)}${separator}${bandLabel(group.difficultyBand, text)}${separator}${focusLabel(group.conceptFocus, text)}`}
                </Text>
                <Text style={styles.groupMeta}>
                  {`${text.members}: ${group.members.map((member) => member.nickname).join(', ') || emptyValue}`}
                </Text>
                <Text style={styles.groupMeta}>
                  {`${text.currentRoles}: ${group.roleAssignments.map((assignment) => `${roleLabel(assignment.role, text)}: ${assignment.nickname ?? emptyValue}`).join(' | ')}`}
                </Text>
                {group.liveHint ? <Text style={styles.hintPill}>{`${text.liveHint}: ${group.liveHint}`}</Text> : null}
                {group.pendingIntervention ? (
                  <Text style={styles.pendingText}>
                    {`${text.interventions}: ${interventionLabel(group.pendingIntervention.kind, text)}${group.pendingIntervention.note ? `${separator}${group.pendingIntervention.note}` : ''}`}
                  </Text>
                ) : null}
                <View style={styles.groupMetricRow}>
                  <Text style={styles.groupMetric}>{`${text.accuracy} ${group.metrics.accuracyPercent}%`}</Text>
                  <Text style={styles.groupMetric}>{`${text.completion} ${group.metrics.completionPercent}%`}</Text>
                  <Text style={styles.groupMetric}>{`${text.rounds} ${group.metrics.roundsCompleted}`}</Text>
                </View>
                <View style={styles.actionGrid}>
                  {interventionOptions.map((kind) => (
                    <TouchableOpacity
                      key={kind}
                      style={styles.actionGridBtn}
                      onPress={() => mp.sendClassroomIntervention({
                        groupCode: group.groupCode,
                        kind,
                        note: kind === 'send_hint' ? buildHint(group, uiLocale) : '',
                      })}
                    >
                      <Text style={styles.actionGridText}>{interventionLabel(kind, text)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </SectionCard>
            ))}

            <SectionCard title={text.report}>
              {teacherView.generatedReport ? (
                <>
                  <Text style={styles.reportLine}>{teacherView.generatedReport.recommendedNextStep}</Text>
                  {teacherView.generatedReport.groupReports.map((group) => (
                    <View key={group.groupCode} style={styles.reportRow}>
                      <Text style={styles.reportGroup}>{group.displayName}</Text>
                      <Text style={styles.reportLine}>{group.recommendation}</Text>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={styles.reportLine}>{text.noReport}</Text>
              )}
            </SectionCard>

            <SectionCard title={text.salesTitle}>
              {text.salesItems.map((item) => (
                <Text key={item} style={styles.salesItem}>{`• ${item}`}</Text>
              ))}
            </SectionCard>

            <View style={styles.bottomActions}>
              <ActionButton label={text.closeSession} onPress={mp.closeClassroomSession} tone="danger" />
              <ActionButton label={text.leaveSession} onPress={mp.leaveClassSession} tone="secondary" />
            </View>
          </>
        )}

        {studentView && (
          <>
            <SectionCard title={`${studentView.group.displayName}${separator}${studentView.group.groupCode}`}>
              <Text style={styles.metricHeadline}>{studentView.settings.title}</Text>
              <Text style={styles.codeValue}>{`${text.sessionCode}: ${studentView.sessionCode}`}</Text>
              <Text style={styles.groupMeta}>{`${text.groupStatus}: ${statusLabel(studentView.group.status, text)}`}</Text>
              <Text style={styles.groupMeta}>{`${text.members}: ${studentView.group.members.map((member) => member.nickname).join(', ')}`}</Text>
              <Text style={styles.groupMeta}>
                {`${text.currentRoles}: ${studentView.group.roleAssignments.map((assignment) => `${roleLabel(assignment.role, text)}: ${assignment.nickname ?? emptyValue}`).join(' | ')}`}
              </Text>
              {studentView.group.liveHint ? <Text style={styles.hintPill}>{`${text.liveHint}: ${studentView.group.liveHint}`}</Text> : null}
              <Text style={styles.recommendationLabel}>{text.recommended}</Text>
              <Text style={styles.recommendationBody}>{studentView.recommendedHint}</Text>
            </SectionCard>

            <SectionCard title={text.interventions}>
              <Text style={styles.groupMeta}>
                {`${bandLabel(studentView.launchConfig.difficultyBand, text)}${separator}${focusLabel(studentView.launchConfig.conceptFocus, text)}`}
              </Text>
              <Text style={styles.groupMeta}>
                {`0-${studentView.launchConfig.mathRangeMax}${separator}${studentView.launchConfig.enabledOperators.map((operator) => operationLabel(operator)).join(' ')}`}
              </Text>
              <View style={styles.bottomActions}>
                <ActionButton
                  label={text.stuck}
                  onPress={() => mp.updateClassroomGroupStatus({
                    status: 'stuck',
                    note: buildHint(studentView.group, uiLocale),
                  })}
                  tone="secondary"
                />
                <ActionButton
                  label={text.finishRound}
                  onPress={() => mp.advanceClassroomRound({
                    completionPercent: Math.min(100, studentView.group.metrics.completionPercent + 20),
                    accuracyPercent: Math.max(studentView.group.metrics.accuracyPercent, 70),
                  })}
                />
              </View>
              <View style={styles.bottomActions}>
                <ActionButton label={text.launchPractice} onPress={() => onLaunchPractice(studentView.launchConfig)} />
                <ActionButton
                  label={text.finishSession}
                  onPress={() => mp.recordClassroomGroupResult({
                    status: 'finished',
                    durationSeconds: studentView.group.metrics.timeOnTaskSeconds || studentView.settings.durationMinutes * 60,
                    attempts: Math.max(1, studentView.group.metrics.attempts),
                    equationSuccesses: Math.max(1, studentView.group.metrics.equationSuccesses),
                    roundsCompleted: Math.max(1, studentView.group.metrics.roundsCompleted),
                    completionPercent: 100,
                  })}
                  tone="danger"
                />
              </View>
              <ActionButton label={text.leaveSession} onPress={mp.leaveClassSession} tone="secondary" />
            </SectionCard>
          </>
        )}

        {mp.error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{mp.error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: brand.bg,
  },
  container: {
    padding: 20,
    paddingBottom: 36,
    gap: 14,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerSpacer: {
    width: 92,
  },
  headerTitle: {
    color: brand.white,
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    color: brand.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'right',
  },
  card: {
    backgroundColor: brand.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.24)',
    padding: 16,
  },
  cardTitle: {
    color: brand.gold,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'right',
  },
  fieldBlock: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: brand.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'right',
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: brand.white,
    textAlign: 'right',
  },
  chipRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.32)',
    backgroundColor: '#0F172A',
  },
  chipActive: {
    backgroundColor: brand.gold,
    borderColor: brand.gold,
  },
  chipText: {
    color: brand.text,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#111827',
  },
  checkboxRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: brand.textMuted,
  },
  checkboxActive: {
    backgroundColor: brand.gold,
    borderColor: brand.gold,
  },
  checkboxLabel: {
    color: brand.text,
    fontSize: 13,
    fontWeight: '700',
  },
  inlineFields: {
    flexDirection: 'row-reverse',
    gap: 12,
  },
  inlineField: {
    flex: 1,
  },
  actionBtn: {
    minWidth: 92,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimary: {
    backgroundColor: brand.gold,
  },
  actionSecondary: {
    backgroundColor: '#0F766E',
  },
  actionDanger: {
    backgroundColor: '#B91C1C',
  },
  actionText: {
    color: brand.white,
    fontWeight: '800',
    fontSize: 13,
  },
  metricHeadline: {
    color: brand.white,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
    marginBottom: 4,
  },
  smallMeta: {
    color: brand.textMuted,
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 4,
  },
  codeValue: {
    color: '#FDE68A',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
    marginBottom: 8,
  },
  kpiRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  kpiCard: {
    width: '47%',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
  },
  kpiValue: {
    color: brand.white,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'right',
  },
  kpiLabel: {
    color: brand.textMuted,
    fontSize: 12,
    textAlign: 'right',
  },
  recommendationLabel: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
    marginTop: 10,
  },
  recommendationBody: {
    color: brand.text,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'right',
    marginTop: 4,
  },
  groupMeta: {
    color: brand.text,
    fontSize: 13,
    textAlign: 'right',
    marginBottom: 6,
    lineHeight: 18,
  },
  hintPill: {
    color: '#FDE68A',
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderRadius: 10,
    padding: 8,
    textAlign: 'right',
    marginBottom: 8,
  },
  pendingText: {
    color: '#A5F3FC',
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 8,
  },
  groupMetricRow: {
    flexDirection: 'row-reverse',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  groupMetric: {
    color: brand.textMuted,
    fontSize: 12,
  },
  actionGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionGridBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionGridText: {
    color: '#CFFAFE',
    fontSize: 12,
    fontWeight: '700',
  },
  reportRow: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(148,163,184,0.18)',
    paddingTop: 8,
    marginTop: 8,
  },
  reportGroup: {
    color: brand.white,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  reportLine: {
    color: brand.text,
    fontSize: 13,
    textAlign: 'right',
    lineHeight: 18,
  },
  salesItem: {
    color: brand.text,
    fontSize: 13,
    textAlign: 'right',
    marginBottom: 4,
  },
  bottomActions: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  errorBox: {
    backgroundColor: 'rgba(220,38,38,0.2)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.4)',
  },
  errorText: {
    color: '#FCA5A5',
    textAlign: 'right',
  },
});
