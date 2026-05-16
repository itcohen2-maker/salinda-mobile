import { randomInt } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  CLASSROOM_BAND_CONFIG,
  buildClassroomLaunchConfig,
  clampClassroomGroupSize,
  nextHigherDifficultyBand,
  nextLowerDifficultyBand,
  normalizeClassroomDuration,
  normalizeClassroomGroupCount,
} from '../../shared/classroomConfig';
import type {
  ClassroomAdvanceRoundPayload,
  ClassroomDashboardKpis,
  ClassroomGroupMetrics,
  ClassroomGroupReport,
  ClassroomGroupSnapshot,
  ClassroomGroupStatus,
  ClassroomIntervention,
  ClassroomInterventionKind,
  ClassroomLiveSettings,
  ClassroomParticipantInfo,
  ClassroomRecordGroupResultPayload,
  ClassroomRoleAssignment,
  ClassroomSessionReport,
  ClassroomSocketState,
  ClassroomStudentView,
  ClassroomTeacherView,
  ClassroomSendInterventionPayload,
  ClassroomGroupStatusUpdatePayload,
  ConceptFocus,
  CreateClassSessionPayload,
  DifficultyBand,
  JoinClassSessionPayload,
  UserRole,
} from '../../shared/types';
import { sanitizePlayerName } from '../../shared/validation';

const SESSION_CODE_LENGTH = 6;
const SESSION_CODE_CHARS = '0123456789';
const CLASSROOM_STALE_MS = 12 * 60 * 60 * 1000;
const MEMBER_ROLES: Array<ClassroomRoleAssignment['role']> = ['roller', 'solver', 'checker', 'reporter'];

type ClassroomBinding = {
  sessionCode: string;
  participantId: string;
};

type ClassroomParticipantRecord = ClassroomParticipantInfo & {
  socketId: string;
};

type ClassroomGroupRecord = {
  sessionCode: string;
  groupCode: string;
  displayName: string;
  status: ClassroomGroupStatus;
  difficultyBand: DifficultyBand;
  conceptFocus: ConceptFocus;
  allowFractions: boolean;
  durationMinutes: number;
  memberIds: string[];
  roundNumber: number;
  liveHint: string | null;
  lastIntervention: ClassroomIntervention | null;
  pendingIntervention: ClassroomIntervention | null;
  interventions: ClassroomIntervention[];
  metrics: ClassroomGroupMetrics;
  updatedAt: number;
};

type ClassroomSessionRecord = {
  sessionCode: string;
  createdAt: number;
  updatedAt: number;
  lifecycle: 'lobby' | 'live' | 'completed';
  settings: ClassroomLiveSettings;
  teacherId: string;
  participants: Map<string, ClassroomParticipantRecord>;
  groups: Map<string, ClassroomGroupRecord>;
  generatedReport: ClassroomSessionReport | null;
};

const classroomSessions = new Map<string, ClassroomSessionRecord>();
const socketToClassroom = new Map<string, ClassroomBinding>();

function emptyMetrics(): ClassroomGroupMetrics {
  return {
    attempts: 0,
    equationSuccesses: 0,
    accuracyPercent: 0,
    completionPercent: 0,
    roundsCompleted: 0,
    timeOnTaskSeconds: 0,
    hintsUsed: 0,
    interventionsReceived: 0,
    stuckMoments: 0,
  };
}

function normalizeMetrics(base: ClassroomGroupMetrics): ClassroomGroupMetrics {
  const attempts = Math.max(0, Math.round(base.attempts));
  const equationSuccesses = Math.max(0, Math.round(base.equationSuccesses));
  const derivedAccuracy = attempts > 0 ? Math.round((equationSuccesses / attempts) * 100) : base.accuracyPercent;
  return {
    attempts,
    equationSuccesses,
    accuracyPercent: Math.max(0, Math.min(100, Math.round(derivedAccuracy))),
    completionPercent: Math.max(0, Math.min(100, Math.round(base.completionPercent))),
    roundsCompleted: Math.max(0, Math.round(base.roundsCompleted)),
    timeOnTaskSeconds: Math.max(0, Math.round(base.timeOnTaskSeconds)),
    hintsUsed: Math.max(0, Math.round(base.hintsUsed)),
    interventionsReceived: Math.max(0, Math.round(base.interventionsReceived)),
    stuckMoments: Math.max(0, Math.round(base.stuckMoments)),
  };
}

function generateSessionCode(): string {
  let code = '';
  do {
    code = '';
    for (let i = 0; i < SESSION_CODE_LENGTH; i += 1) {
      code += SESSION_CODE_CHARS[randomInt(0, SESSION_CODE_CHARS.length)];
    }
  } while (classroomSessions.has(code));
  return code;
}

function sanitizeText(raw: unknown, fallback: string, maxLen = 48): string {
  return sanitizePlayerName(raw, maxLen) ?? fallback;
}

function normalizeLiveSettings(raw: ClassroomLiveSettings): ClassroomLiveSettings {
  return {
    sessionMode: raw.sessionMode,
    title: sanitizeText(raw.title, 'Salinda Classroom', 60),
    className: sanitizeText(raw.className, 'כיתה', 40),
    schoolName: raw.schoolName ? sanitizeText(raw.schoolName, '', 40) : null,
    gradeBand: raw.gradeBand,
    difficultyBand: raw.difficultyBand,
    conceptFocus: raw.conceptFocus,
    taskTemplate: raw.taskTemplate,
    durationMinutes: normalizeClassroomDuration(raw.durationMinutes),
    groupSize: clampClassroomGroupSize(raw.groupSize),
    groupCount: normalizeClassroomGroupCount(raw.groupCount),
    allowFractions: !!raw.allowFractions,
  };
}

function buildRoleAssignments(
  participants: Map<string, ClassroomParticipantRecord>,
  memberIds: string[],
  roundNumber: number,
): ClassroomRoleAssignment[] {
  if (memberIds.length === 0) {
    return MEMBER_ROLES.map((role) => ({ role, participantId: null, nickname: null }));
  }
  return MEMBER_ROLES.map((role, index) => {
    const slot = (Math.max(roundNumber - 1, 0) + index) % memberIds.length;
    const participant = participants.get(memberIds[slot] ?? '');
    return {
      role,
      participantId: participant?.participantId ?? null,
      nickname: participant?.nickname ?? null,
    };
  });
}

function buildGroupSnapshot(
  session: ClassroomSessionRecord,
  group: ClassroomGroupRecord,
): ClassroomGroupSnapshot {
  const members = group.memberIds
    .map((participantId) => session.participants.get(participantId))
    .filter((participant): participant is ClassroomParticipantRecord => participant != null)
    .map<ClassroomParticipantInfo>((participant) => ({
      participantId: participant.participantId,
      nickname: participant.nickname,
      role: participant.role,
      groupCode: participant.groupCode,
      connected: participant.connected,
      joinedAt: participant.joinedAt,
    }));

  return {
    sessionCode: group.sessionCode,
    groupCode: group.groupCode,
    displayName: group.displayName,
    status: group.status,
    difficultyBand: group.difficultyBand,
    conceptFocus: group.conceptFocus,
    allowFractions: group.allowFractions,
    durationMinutes: group.durationMinutes,
    bandConfig: CLASSROOM_BAND_CONFIG[group.difficultyBand],
    members,
    roleAssignments: buildRoleAssignments(session.participants, group.memberIds, group.roundNumber),
    roundNumber: group.roundNumber,
    liveHint: group.liveHint,
    lastIntervention: group.lastIntervention,
    pendingIntervention: group.pendingIntervention,
    metrics: normalizeMetrics(group.metrics),
    updatedAt: group.updatedAt,
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildKpis(session: ClassroomSessionRecord): ClassroomDashboardKpis {
  const groups = [...session.groups.values()];
  const snapshots = groups.map((group) => buildGroupSnapshot(session, group));
  return {
    activeGroups: snapshots.filter((group) => group.status === 'active').length,
    stuckGroups: snapshots.filter((group) => group.status === 'stuck').length,
    finishedGroups: snapshots.filter((group) => group.status === 'finished').length,
    inactiveGroups: snapshots.filter((group) => group.status === 'inactive').length,
    atRiskGroups: snapshots.filter((group) => group.status === 'stuck' || group.metrics.accuracyPercent < 60).length,
    averageAccuracy: average(snapshots.map((group) => group.metrics.accuracyPercent)),
    averageCompletion: average(snapshots.map((group) => group.metrics.completionPercent)),
    averageRounds: average(snapshots.map((group) => group.metrics.roundsCompleted)),
    totalHintsUsed: snapshots.reduce((sum, group) => sum + group.metrics.hintsUsed, 0),
  };
}

function buildSessionRecommendation(kpis: ClassroomDashboardKpis): string {
  if (kpis.stuckGroups > 0) return 'יש קבוצות תקועות. מומלץ לשלוח רמז פדגוגי לפני העלאת קושי.';
  if (kpis.averageAccuracy < 60) return 'הדיוק עדיין נמוך. השאירו את הרמה הנוכחית והפעילו סבב תגבור ממוקד.';
  if (kpis.finishedGroups > 0 && kpis.averageAccuracy >= 75) return 'הכיתה מוכנה להעמקה. אפשר לפתוח אתגר לקבוצות שסיימו.';
  return 'שמרו על הקצב, עקבו אחר קבוצות לא פעילות ובדקו אם נדרש חיזוק נקודתי.';
}

function buildGroupRecommendation(snapshot: ClassroomGroupSnapshot): string {
  if (snapshot.status === 'stuck') return 'לשלוח רמז פדגוגי על בחירת פעולה או סדר פעולות.';
  if (snapshot.metrics.accuracyPercent < 60) return 'להישאר ברמת הקושי הנוכחית ולעבור לסבב תגבור.';
  if (snapshot.metrics.completionPercent >= 100) return 'להקצות אתגר נוסף או לעבור למסלול חיזוק הבא.';
  return 'להמשיך לסבב נוסף ולוודא רוטציית תפקידים מלאה.';
}

function buildTeacherView(session: ClassroomSessionRecord, role: 'teacher' | 'admin'): ClassroomTeacherView {
  const groups = [...session.groups.values()]
    .sort((a, b) => a.groupCode.localeCompare(b.groupCode))
    .map((group) => buildGroupSnapshot(session, group));
  const kpis = buildKpis(session);
  return {
    role,
    sessionCode: session.sessionCode,
    lifecycle: session.lifecycle,
    createdAt: session.createdAt,
    settings: session.settings,
    kpis,
    groups,
    generatedReport: session.generatedReport,
    recommendedNextStep: buildSessionRecommendation(kpis),
  };
}

function buildStudentView(session: ClassroomSessionRecord, participant: ClassroomParticipantRecord): ClassroomStudentView {
  const group = participant.groupCode ? session.groups.get(participant.groupCode) : null;
  if (!group) {
    throw new Error(`Participant ${participant.participantId} is missing classroom group`);
  }
  const snapshot = buildGroupSnapshot(session, group);
  return {
    role: 'student',
    sessionCode: session.sessionCode,
    lifecycle: session.lifecycle,
    joinedAt: participant.joinedAt,
    settings: session.settings,
    group: snapshot,
    launchConfig: buildClassroomLaunchConfig(session.settings, group.difficultyBand),
    recommendedHint: buildGroupRecommendation(snapshot),
  };
}

function buildSocketState(session: ClassroomSessionRecord, participantId: string): ClassroomSocketState {
  const participant = session.participants.get(participantId);
  if (!participant) {
    throw new Error(`Participant ${participantId} not found in session ${session.sessionCode}`);
  }
  if (participant.role === 'teacher' || participant.role === 'admin') {
    return {
      participantId,
      role: participant.role,
      sessionCode: session.sessionCode,
      teacherView: buildTeacherView(session, participant.role),
      studentView: null,
    };
  }
  return {
    participantId,
    role: participant.role,
    sessionCode: session.sessionCode,
    teacherView: null,
    studentView: buildStudentView(session, participant),
  };
}

function bumpSession(session: ClassroomSessionRecord): void {
  session.updatedAt = Date.now();
  if (session.lifecycle === 'lobby') session.lifecycle = 'live';
}

function buildGroupRecord(
  sessionCode: string,
  settings: ClassroomLiveSettings,
  groupIndex: number,
): ClassroomGroupRecord {
  return {
    sessionCode,
    groupCode: `G${groupIndex + 1}`,
    displayName: `קבוצה ${groupIndex + 1}`,
    status: 'inactive',
    difficultyBand: settings.difficultyBand,
    conceptFocus: settings.conceptFocus,
    allowFractions: settings.allowFractions,
    durationMinutes: settings.durationMinutes,
    memberIds: [],
    roundNumber: 1,
    liveHint: null,
    lastIntervention: null,
    pendingIntervention: null,
    interventions: [],
    metrics: emptyMetrics(),
    updatedAt: Date.now(),
  };
}

function createParticipantRecord(
  nickname: string,
  role: UserRole,
  groupCode: string | null,
  socketId: string,
): ClassroomParticipantRecord {
  return {
    participantId: uuidv4(),
    nickname,
    role,
    groupCode,
    connected: true,
    joinedAt: Date.now(),
    socketId,
  };
}

function assertSessionExists(sessionCode: string): ClassroomSessionRecord | null {
  return classroomSessions.get(sessionCode) ?? null;
}

function applyMetricsUpdate(
  group: ClassroomGroupRecord,
  payload: Partial<Pick<ClassroomGroupStatusUpdatePayload, 'accuracyPercent' | 'completionPercent' | 'timeOnTaskSeconds' | 'attemptsDelta' | 'equationSuccessesDelta'>>,
): void {
  if (payload.attemptsDelta != null) group.metrics.attempts += Math.max(0, Math.round(payload.attemptsDelta));
  if (payload.equationSuccessesDelta != null) group.metrics.equationSuccesses += Math.max(0, Math.round(payload.equationSuccessesDelta));
  if (payload.accuracyPercent != null) group.metrics.accuracyPercent = payload.accuracyPercent;
  if (payload.completionPercent != null) group.metrics.completionPercent = payload.completionPercent;
  if (payload.timeOnTaskSeconds != null) group.metrics.timeOnTaskSeconds = Math.max(group.metrics.timeOnTaskSeconds, Math.round(payload.timeOnTaskSeconds));
  group.metrics = normalizeMetrics(group.metrics);
}

function interventionWithBand(kind: ClassroomInterventionKind, currentBand: DifficultyBand): DifficultyBand | null {
  switch (kind) {
    case 'lower_difficulty':
    case 'open_remedial_round':
      return nextLowerDifficultyBand(currentBand);
    case 'raise_difficulty':
    case 'open_challenge_round':
      return nextHigherDifficultyBand(currentBand);
    default:
      return null;
  }
}

function buildIntervention(
  group: ClassroomGroupRecord,
  createdBy: string,
  kind: ClassroomInterventionKind,
  note?: string,
): ClassroomIntervention {
  return {
    id: uuidv4(),
    kind,
    targetGroupCode: group.groupCode,
    note: sanitizeText(note, '', 120),
    applyOnNextRound:
      kind === 'lower_difficulty' ||
      kind === 'raise_difficulty' ||
      kind === 'open_remedial_round' ||
      kind === 'open_challenge_round',
    createdAt: Date.now(),
    createdBy,
    nextDifficultyBand: interventionWithBand(kind, group.difficultyBand),
  };
}

function applyImmediateIntervention(group: ClassroomGroupRecord, intervention: ClassroomIntervention): void {
  if (intervention.kind === 'send_hint') {
    group.liveHint = intervention.note || 'בדקו איזה פעולה מקרבת אתכם למספר היעד.';
    group.metrics.hintsUsed += 1;
  } else if (intervention.kind === 'freeze_round') {
    group.status = 'inactive';
    group.liveHint = intervention.note || 'הסבב הוקפא. חזרו לקרוא את ההנחיה ולתאם תפקידים.';
  } else if (intervention.kind === 'regroup_next_session') {
    group.liveHint = intervention.note || 'המורה יסדר מחדש את הקבוצות לפני הסשן הבא.';
  }
}

function applyPendingIntervention(group: ClassroomGroupRecord): void {
  if (!group.pendingIntervention) return;
  if (group.pendingIntervention.nextDifficultyBand) {
    group.difficultyBand = group.pendingIntervention.nextDifficultyBand;
  }
  group.lastIntervention = group.pendingIntervention;
  group.pendingIntervention = null;
  group.liveHint = null;
}

function buildReport(session: ClassroomSessionRecord): ClassroomSessionReport {
  const groups = [...session.groups.values()]
    .sort((a, b) => a.groupCode.localeCompare(b.groupCode))
    .map((group): ClassroomGroupReport => {
      const snapshot = buildGroupSnapshot(session, group);
      return {
        groupCode: snapshot.groupCode,
        displayName: snapshot.displayName,
        status: snapshot.status,
        difficultyBand: snapshot.difficultyBand,
        conceptFocus: snapshot.conceptFocus,
        allowFractions: snapshot.allowFractions,
        members: snapshot.members.map((member) => member.nickname),
        metrics: snapshot.metrics,
        recommendation: buildGroupRecommendation(snapshot),
        interventions: [...group.interventions],
      };
    });
  const kpis = buildKpis(session);
  return {
    sessionCode: session.sessionCode,
    title: session.settings.title,
    className: session.settings.className,
    schoolName: session.settings.schoolName ?? null,
    gradeBand: session.settings.gradeBand,
    taskTemplate: session.settings.taskTemplate,
    conceptFocus: session.settings.conceptFocus,
    generatedAt: Date.now(),
    durationMinutes: session.settings.durationMinutes,
    kpis,
    recommendedNextStep: buildSessionRecommendation(kpis),
    groupReports: groups,
  };
}

export function createClassSession(
  payload: CreateClassSessionPayload,
  socketId: string,
): { sessionCode: string; participantId: string } | { error: string } {
  const teacherName = sanitizePlayerName(payload.teacherName, 24);
  if (!teacherName) return { error: 'יש להזין שם מורה תקין.' };
  const settings = normalizeLiveSettings(payload.settings);
  const sessionCode = generateSessionCode();
  const teacher = createParticipantRecord(teacherName, 'teacher', null, socketId);
  const session: ClassroomSessionRecord = {
    sessionCode,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lifecycle: 'lobby',
    settings,
    teacherId: teacher.participantId,
    participants: new Map([[teacher.participantId, teacher]]),
    groups: new Map(),
    generatedReport: null,
  };
  for (let index = 0; index < settings.groupCount; index += 1) {
    const group = buildGroupRecord(sessionCode, settings, index);
    session.groups.set(group.groupCode, group);
  }
  classroomSessions.set(sessionCode, session);
  socketToClassroom.set(socketId, { sessionCode, participantId: teacher.participantId });
  return { sessionCode, participantId: teacher.participantId };
}

export function joinClassSession(
  payload: JoinClassSessionPayload,
  socketId: string,
): { sessionCode: string; participantId: string } | { error: string } {
  const session = assertSessionExists(payload.sessionCode);
  if (!session) return { error: 'קוד הכיתה לא נמצא.' };
  if (session.lifecycle === 'completed') return { error: 'הסשן הכיתתי כבר נסגר.' };
  const nickname = sanitizePlayerName(payload.nickname, 24);
  if (!nickname) return { error: 'יש להזין כינוי תלמיד תקין.' };
  const group = session.groups.get(payload.groupCode.trim().toUpperCase());
  if (!group) return { error: 'קוד הקבוצה לא תקין.' };
  if (group.memberIds.length >= session.settings.groupSize) return { error: 'הקבוצה מלאה. נסו קבוצה אחרת.' };
  const duplicate = group.memberIds
    .map((participantId) => session.participants.get(participantId))
    .some((participant) => participant?.nickname === nickname);
  if (duplicate) return { error: 'הכינוי כבר תפוס בקבוצה הזו.' };
  const participant = createParticipantRecord(nickname, 'student', group.groupCode, socketId);
  session.participants.set(participant.participantId, participant);
  group.memberIds.push(participant.participantId);
  if (group.status === 'inactive') group.status = 'active';
  group.updatedAt = Date.now();
  bumpSession(session);
  socketToClassroom.set(socketId, { sessionCode: session.sessionCode, participantId: participant.participantId });
  return { sessionCode: session.sessionCode, participantId: participant.participantId };
}

export function getClassroomBindingBySocket(socketId: string): ClassroomBinding | null {
  return socketToClassroom.get(socketId) ?? null;
}

export function getClassroomStatesForSession(sessionCode: string): ClassroomSocketState[] {
  const session = classroomSessions.get(sessionCode);
  if (!session) return [];
  return [...session.participants.keys()].map((participantId) => buildSocketState(session, participantId));
}

export function getClassroomSocketState(
  sessionCode: string,
  participantId: string,
): ClassroomSocketState | null {
  const session = classroomSessions.get(sessionCode);
  if (!session || !session.participants.has(participantId)) return null;
  return buildSocketState(session, participantId);
}

export function updateClassroomGroupStatus(
  socketId: string,
  payload: ClassroomGroupStatusUpdatePayload,
): { sessionCode: string } | { error: string } {
  const binding = getClassroomBindingBySocket(socketId);
  if (!binding) return { error: 'לא נמצא סשן כיתתי פעיל.' };
  const session = assertSessionExists(binding.sessionCode);
  if (!session) return { error: 'הסשן הכיתתי לא נמצא.' };
  const participant = session.participants.get(binding.participantId);
  if (!participant?.groupCode) return { error: 'רק תלמידים בקבוצה יכולים לעדכן סטטוס.' };
  const group = session.groups.get(participant.groupCode);
  if (!group) return { error: 'הקבוצה לא נמצאה.' };
  group.status = payload.status;
  if (payload.status === 'stuck') group.metrics.stuckMoments += 1;
  if (payload.note) group.liveHint = sanitizeText(payload.note, '', 140);
  applyMetricsUpdate(group, payload);
  group.updatedAt = Date.now();
  bumpSession(session);
  return { sessionCode: session.sessionCode };
}

export function advanceClassroomRound(
  socketId: string,
  payload: ClassroomAdvanceRoundPayload,
): { sessionCode: string } | { error: string } {
  const binding = getClassroomBindingBySocket(socketId);
  if (!binding) return { error: 'לא נמצא סשן כיתתי פעיל.' };
  const session = assertSessionExists(binding.sessionCode);
  if (!session) return { error: 'הסשן הכיתתי לא נמצא.' };
  const participant = session.participants.get(binding.participantId);
  if (!participant?.groupCode) return { error: 'רק תלמידים בקבוצה יכולים לקדם סבב.' };
  const group = session.groups.get(participant.groupCode);
  if (!group) return { error: 'הקבוצה לא נמצאה.' };
  applyPendingIntervention(group);
  group.roundNumber += 1;
  group.status = 'active';
  group.metrics.roundsCompleted += 1;
  if (payload.note) group.liveHint = sanitizeText(payload.note, '', 140);
  applyMetricsUpdate(group, payload);
  group.updatedAt = Date.now();
  bumpSession(session);
  return { sessionCode: session.sessionCode };
}

export function sendClassroomIntervention(
  socketId: string,
  payload: ClassroomSendInterventionPayload,
): { sessionCode: string } | { error: string } {
  const binding = getClassroomBindingBySocket(socketId);
  if (!binding) return { error: 'לא נמצא סשן כיתתי פעיל.' };
  const session = assertSessionExists(binding.sessionCode);
  if (!session) return { error: 'הסשן הכיתתי לא נמצא.' };
  const participant = session.participants.get(binding.participantId);
  if (!participant || (participant.role !== 'teacher' && participant.role !== 'admin')) {
    return { error: 'רק מורה יכול לשלוח התערבות.' };
  }
  const group = session.groups.get(payload.groupCode.trim().toUpperCase());
  if (!group) return { error: 'קוד הקבוצה לא תקין.' };
  const intervention = buildIntervention(group, participant.nickname, payload.kind, payload.note);
  group.metrics.interventionsReceived += 1;
  group.interventions.push(intervention);
  if (intervention.applyOnNextRound) {
    group.pendingIntervention = intervention;
  } else {
    group.lastIntervention = intervention;
    applyImmediateIntervention(group, intervention);
  }
  group.updatedAt = Date.now();
  bumpSession(session);
  return { sessionCode: session.sessionCode };
}

export function recordClassroomGroupResult(
  socketId: string,
  payload: ClassroomRecordGroupResultPayload,
): { sessionCode: string } | { error: string } {
  const binding = getClassroomBindingBySocket(socketId);
  if (!binding) return { error: 'לא נמצא סשן כיתתי פעיל.' };
  const session = assertSessionExists(binding.sessionCode);
  if (!session) return { error: 'הסשן הכיתתי לא נמצא.' };
  const participant = session.participants.get(binding.participantId);
  if (!participant?.groupCode) return { error: 'רק תלמידים בקבוצה יכולים לשמור תוצאה.' };
  const group = session.groups.get(participant.groupCode);
  if (!group) return { error: 'הקבוצה לא נמצאה.' };
  group.status = payload.status;
  group.metrics.attempts = Math.max(group.metrics.attempts, Math.round(payload.attempts));
  group.metrics.equationSuccesses = Math.max(group.metrics.equationSuccesses, Math.round(payload.equationSuccesses));
  group.metrics.roundsCompleted = Math.max(group.metrics.roundsCompleted, Math.round(payload.roundsCompleted));
  group.metrics.timeOnTaskSeconds = Math.max(group.metrics.timeOnTaskSeconds, Math.round(payload.durationSeconds));
  group.metrics.completionPercent = Math.max(group.metrics.completionPercent, Math.round(payload.completionPercent));
  group.metrics = normalizeMetrics(group.metrics);
  group.updatedAt = Date.now();
  bumpSession(session);
  return { sessionCode: session.sessionCode };
}

export function closeClassSession(
  socketId: string,
): { sessionCode: string; report: ClassroomSessionReport } | { error: string } {
  const binding = getClassroomBindingBySocket(socketId);
  if (!binding) return { error: 'לא נמצא סשן כיתתי פעיל.' };
  const session = assertSessionExists(binding.sessionCode);
  if (!session) return { error: 'הסשן הכיתתי לא נמצא.' };
  const participant = session.participants.get(binding.participantId);
  if (!participant || (participant.role !== 'teacher' && participant.role !== 'admin')) {
    return { error: 'רק מורה יכול לסגור סשן כיתתי.' };
  }
  session.lifecycle = 'completed';
  session.generatedReport = buildReport(session);
  session.updatedAt = Date.now();
  return { sessionCode: session.sessionCode, report: session.generatedReport };
}

export function leaveClassSession(
  socketId: string,
): { sessionCode: string; report?: ClassroomSessionReport } | null {
  const binding = socketToClassroom.get(socketId);
  if (!binding) return null;
  socketToClassroom.delete(socketId);
  const session = classroomSessions.get(binding.sessionCode);
  if (!session) return null;
  const participant = session.participants.get(binding.participantId);
  if (!participant) return null;
  participant.connected = false;
  participant.socketId = '';
  session.updatedAt = Date.now();
  if (participant.groupCode) {
    const group = session.groups.get(participant.groupCode);
    if (group) {
      const activeMembers = group.memberIds
        .map((participantId) => session.participants.get(participantId))
        .filter((member): member is ClassroomParticipantRecord => member != null && member.connected);
      if (activeMembers.length === 0 && group.status !== 'finished') {
        group.status = 'inactive';
      }
      group.updatedAt = Date.now();
    }
  }
  if (participant.role === 'teacher' || participant.role === 'admin') {
    session.lifecycle = 'completed';
    session.generatedReport = buildReport(session);
    return { sessionCode: session.sessionCode, report: session.generatedReport };
  }
  return { sessionCode: session.sessionCode };
}

export function cleanupStaleClassSessions(): void {
  const now = Date.now();
  for (const [sessionCode, session] of classroomSessions.entries()) {
    if (now - session.updatedAt <= CLASSROOM_STALE_MS) continue;
    classroomSessions.delete(sessionCode);
    for (const participant of session.participants.values()) {
      socketToClassroom.delete(participant.socketId);
    }
  }
}
