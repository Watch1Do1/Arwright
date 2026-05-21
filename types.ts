
export interface IntegrityReport {
  keystrokeCount: number;
  pasteEvents: number;
  pasteCharacters: number;
  averageWPM: number;
  flagged: boolean;
  burstAlerts: number;
}

export interface Feedback {
  type: 'concept' | 'structure' | 'mechanics' | 'witty-remark';
  content: string;
}

export enum WritingMode {
  ACADEMIC = 'ACADEMIC',
  ANALYTICAL = 'ANALYTICAL',
  NARRATIVE = 'NARRATIVE',
  ARGUMENTATIVE = 'ARGUMENTATIVE',
  TECHNICAL = 'TECHNICAL'
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  title: string;
  type: 'grammar' | 'vocabulary' | 'structure';
  questions: QuizQuestion[];
}

export interface FeedbackItem {
  id: string;
  feedback: string;
  focusArea: string;
  suggestedExercise?: string;
  timestamp: number;
  quiz?: Quiz;
}

export enum UserRole {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  SCHOOL_ADMIN = 'SCHOOL_ADMIN',
  ADMIN = 'ADMIN'
}

export interface SchoolAdminInvite {
  id: string;
  email: string;
  schoolId: string;
  role: UserRole.SCHOOL_ADMIN;
  token: string;
  createdAt: number;
  expiresAt: number;
  acceptedAt?: number;
  acceptedByUid?: string;
  status: 'pending' | 'accepted' | 'expired';
}

export enum UserStatus {
  PRE_ACTIVE = 'PRE-ACTIVE',
  ACTIVE_STUDENT = 'ACTIVE-STUDENT',
  DETACHED_STUDENT = 'DETACHED-STUDENT',
  ALUMNUS = 'ALUMNUS',
  ARCHIVED = 'ARCHIVED'
}

export interface UserProfile {
  uid: string;
  email: string;
  recoveryEmail?: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  nameHistory?: { name: string; changedAt: number }[];
  photoURL?: string;
  role: UserRole;
  status: UserStatus;
  schoolId?: string;
  cohortId?: string;
  classIds?: string[];
  disabled?: boolean;
  createdAt: number;
  graduationDate?: number;
}

export interface Cohort {
  id: string;
  schoolId: string;
  name: string; // e.g. "Class of 2029"
  graduationDate: number;
  cohortCode: string;
}

export interface School {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
  schoolType: string;
  status: 'Prospect' | 'Pilot' | 'Active' | 'Paused';
  contactName: string;
  contactEmail: string;
  schoolCode: string;
  domain?: string;
  enrollmentSize?: string;
  gradesServed?: string;
  ncesId?: string;
  submissionCount: number;
  userCount: number;
}

export interface Classroom {
  id: string;
  name: string;
  gradeLevel?: string;
  period?: string;
  schoolId: string;
  teacherId: string;
  teacherName: string;
  classCode: string;
  studentCount: number;
  createdAt: number;
  expiresAt?: number; // Store as timestamp for consistency with security rules
}

export interface AiUsageLog {
  id: string;
  userId: string;
  model: string;
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
  timestamp: number;
  feature: string; // e.g., 'summary', 'tutor-feedback', 'quiz'
}

export type ParagraphKind = 'body' | 'title' | 'works-cited-title' | 'works-cited-entry';

export interface Paragraph {
  id: string;
  text: string;
  kind: ParagraphKind;
}

export interface WritingDocument {
  paragraphs: Paragraph[];
}

export interface ProficiencyMetrics {
  approximateProficiencyBand: string;
  readabilityScore: number;
  vocabularyComplexity: 'Low' | 'Medium' | 'High';
  structuralMaturity: 'Developing' | 'Proficient' | 'Advanced';
  feedbackSummary: string;
}

export interface IntegrityReview {
  summary: string;
  signals: {
    label: string;
    value: string;
    status: 'neutral' | 'caution' | 'positive';
  }[];
  contextualNotes: string;
  instructionalGuidance: string;
  timestamp: number;
}

export interface Submission {
  id: string;
  studentId: string;
  studentName: string;
  classId?: string;
  document: WritingDocument;
  timestamp: number;
  integrity: IntegrityReport;
  tutorSummary: string;
  mode: WritingMode;
  thinkingTrace?: ThinkingEvent[];
  proficiencyMetrics?: ProficiencyMetrics;
  integrityReview?: IntegrityReview;
}

export interface ThinkingEvent {
  t: number;
  len: number;
  strokes: number;
  paste?: number;
  ai?: {
    query: string;
    focus: string;
  };
  content: string;
}

export enum MentorPersonality {
  OXFORD_DON = 'OXFORD_DON',
  SUPPORTIVE_COACH = 'SUPPORTIVE_COACH',
  TECHNICAL_ARCHITECT = 'TECHNICAL_ARCHITECT',
  CREATIVE_CATALYST = 'CREATIVE_CATALYST'
}
