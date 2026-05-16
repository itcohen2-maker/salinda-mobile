export type UserRole = 'student' | 'teacher' | 'admin';
export type SessionMode = 'class_live' | 'practice_assignment';
export type GradeBand = 'g3' | 'g4' | 'g5' | 'g6';
export type DifficultyBand = 'support' | 'core' | 'bridge' | 'challenge';
export type ConceptFocus = 'add_sub' | 'mul_div' | 'fractions' | 'mixed';
export type ClassroomTaskTemplate = 'warmup' | 'remedial' | 'fluency_race' | 'mixed_review';
export type ClassroomGroupStatus = 'active' | 'stuck' | 'finished' | 'inactive';
export type ClassroomMemberRole = 'roller' | 'solver' | 'checker' | 'reporter';
export type ClassroomInterventionKind =
  | 'lower_difficulty'
  | 'raise_difficulty'
  | 'send_hint'
  | 'open_remedial_round'
  | 'open_challenge_round'
  | 'freeze_round'
  | 'regroup_next_session';
export type ClassroomSessionLifecycle = 'lobby' | 'live' | 'completed';
export type ClassroomOperation = '+' | '-' | 'x' | '÷';
export type ClassroomFraction = '1/2' | '1/3' | '1/4' | '1/5';
export type ClassroomBotDifficulty = 'easy' | 'medium' | 'hard';
export type ClassroomDifficultyStage = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export interface ClassroomBandConfig {
  difficultyBand: DifficultyBand;
  stageIds: ClassroomDifficultyStage[];
  rangeMax: 12 | 25;
  enabledOperators: ClassroomOperation[];
  allowFractions: boolean;
  teacherLabel: string;
}

export interface ClassroomLiveSettings {
  sessionMode: SessionMode;
  title: string;
  className: string;
  schoolName?: string | null;
  gradeBand: GradeBand;
  difficultyBand: DifficultyBand;
  conceptFocus: ConceptFocus;
  taskTemplate: ClassroomTaskTemplate;
  durationMinutes: number;
  groupSize: 3 | 4 | 5;
  groupCount: number;
  allowFractions: boolean;
}

export interface ClassroomLaunchConfig {
  mode: 'vs-bot';
  difficulty: 'easy' | 'full';
  difficultyBand: DifficultyBand;
  gradeBand: GradeBand;
  conceptFocus: ConceptFocus;
  durationMinutes: number;
  showFractions: boolean;
  fractionKinds: ClassroomFraction[];
  mathRangeMax: 12 | 25;
  enabledOperators: ClassroomOperation[];
  difficultyStage: ClassroomDifficultyStage;
  botDifficulty: ClassroomBotDifficulty;
}

export interface ClassroomParticipantInfo {
  participantId: string;
  nickname: string;
  role: UserRole;
  groupCode: string | null;
  connected: boolean;
  joinedAt: number;
}

export interface ClassroomRoleAssignment {
  role: ClassroomMemberRole;
  participantId: string | null;
  nickname: string | null;
}

export interface ClassroomGroupMetrics {
  attempts: number;
  equationSuccesses: number;
  accuracyPercent: number;
  completionPercent: number;
  roundsCompleted: number;
  timeOnTaskSeconds: number;
  hintsUsed: number;
  interventionsReceived: number;
  stuckMoments: number;
}

export interface ClassroomIntervention {
  id: string;
  kind: ClassroomInterventionKind;
  targetGroupCode: string;
  note: string;
  applyOnNextRound: boolean;
  createdAt: number;
  createdBy: string;
  nextDifficultyBand: DifficultyBand | null;
}

export interface ClassroomGroupSnapshot {
  sessionCode: string;
  groupCode: string;
  displayName: string;
  status: ClassroomGroupStatus;
  difficultyBand: DifficultyBand;
  conceptFocus: ConceptFocus;
  allowFractions: boolean;
  durationMinutes: number;
  bandConfig: ClassroomBandConfig;
  members: ClassroomParticipantInfo[];
  roleAssignments: ClassroomRoleAssignment[];
  roundNumber: number;
  liveHint: string | null;
  lastIntervention: ClassroomIntervention | null;
  pendingIntervention: ClassroomIntervention | null;
  metrics: ClassroomGroupMetrics;
  updatedAt: number;
}

export interface ClassroomDashboardKpis {
  activeGroups: number;
  stuckGroups: number;
  finishedGroups: number;
  inactiveGroups: number;
  atRiskGroups: number;
  averageAccuracy: number;
  averageCompletion: number;
  averageRounds: number;
  totalHintsUsed: number;
}

export interface ClassroomGroupReport {
  groupCode: string;
  displayName: string;
  status: ClassroomGroupStatus;
  difficultyBand: DifficultyBand;
  conceptFocus: ConceptFocus;
  allowFractions: boolean;
  members: string[];
  metrics: ClassroomGroupMetrics;
  recommendation: string;
  interventions: ClassroomIntervention[];
}

export interface ClassroomSessionReport {
  sessionCode: string;
  title: string;
  className: string;
  schoolName?: string | null;
  gradeBand: GradeBand;
  taskTemplate: ClassroomTaskTemplate;
  conceptFocus: ConceptFocus;
  generatedAt: number;
  durationMinutes: number;
  kpis: ClassroomDashboardKpis;
  recommendedNextStep: string;
  groupReports: ClassroomGroupReport[];
}

export interface ClassroomTeacherView {
  role: 'teacher' | 'admin';
  sessionCode: string;
  lifecycle: ClassroomSessionLifecycle;
  createdAt: number;
  settings: ClassroomLiveSettings;
  kpis: ClassroomDashboardKpis;
  groups: ClassroomGroupSnapshot[];
  generatedReport: ClassroomSessionReport | null;
  recommendedNextStep: string;
}

export interface ClassroomStudentView {
  role: 'student';
  sessionCode: string;
  lifecycle: ClassroomSessionLifecycle;
  joinedAt: number;
  settings: ClassroomLiveSettings;
  group: ClassroomGroupSnapshot;
  launchConfig: ClassroomLaunchConfig;
  recommendedHint: string;
}

export interface ClassroomSocketState {
  participantId: string;
  role: UserRole;
  sessionCode: string;
  teacherView: ClassroomTeacherView | null;
  studentView: ClassroomStudentView | null;
}

export interface CreateClassSessionPayload {
  teacherName: string;
  settings: ClassroomLiveSettings;
}

export interface JoinClassSessionPayload {
  sessionCode: string;
  groupCode: string;
  nickname: string;
}

export interface ClassroomGroupStatusUpdatePayload {
  status: ClassroomGroupStatus;
  note?: string;
  accuracyPercent?: number;
  completionPercent?: number;
  timeOnTaskSeconds?: number;
  attemptsDelta?: number;
  equationSuccessesDelta?: number;
}

export interface ClassroomAdvanceRoundPayload {
  note?: string;
  accuracyPercent?: number;
  completionPercent?: number;
  timeOnTaskSeconds?: number;
  attemptsDelta?: number;
  equationSuccessesDelta?: number;
}

export interface ClassroomSendInterventionPayload {
  groupCode: string;
  kind: ClassroomInterventionKind;
  note?: string;
}

export interface ClassroomRecordGroupResultPayload {
  status: ClassroomGroupStatus;
  durationSeconds: number;
  attempts: number;
  equationSuccesses: number;
  roundsCompleted: number;
  completionPercent: number;
}
