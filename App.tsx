
/**
 * ARWRIGHT: ACADEMIC WRITING MENTOR
 * 
 * INTENT BOUNDARY:
 * Arwright’s AI analytics are used for instructional support and product improvement. 
 * Formal research analysis would occur only under appropriate IRB approval.
 */

import React, { useState, useEffect, useRef } from 'react';
import Layout from './components/Layout';
import StudentMode from './components/StudentMode';
import TeacherMode from './components/TeacherMode';
import { UserRole, UserStatus, Submission, IntegrityReport, WritingMode, ThinkingEvent, UserProfile, WritingDocument, Cohort, Classroom } from './types';
import { summarizeSubmissionForTeacher, estimateWritingProficiency, authedFetch } from './services/geminiService';
import { auth, db, signInWithGoogle } from './services/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, addDoc, getDoc, doc, getDocs, updateDoc, where, limit, arrayUnion } from 'firebase/firestore';
import { LogIn, LogOut, User as UserIcon, ShieldAlert, GraduationCap, Briefcase, Link as LinkIcon } from 'lucide-react';
import AdminMode from './components/AdminMode';
import SchoolAdminMode from './components/SchoolAdminMode';
import AcceptInvite from './components/AcceptInvite';
import { motion, AnimatePresence } from 'motion/react';

const DEFAULT_DEMO_SUBMISSIONS: Submission[] = [
  {
    id: 'demo-sub-1',
    studentId: 'demo-user-123',
    studentName: 'Julian Thorne',
    document: {
      paragraphs: [
        { id: 'p1', kind: 'title', text: 'The Paradox of Modern Efficiency' },
        { id: 'p2', kind: 'body', text: 'Modern efficiency is often heralded as the pinnacle of industrial progress. However, when we strip away the machinery, we find a curious hollow at the center of human agency...' },
        { id: 'p3', kind: 'body', text: 'Consider the digital workspace. Tools designed to save time often end up segmenting our attention, forcing us into roles where we react to automated cues rather than initiating original thoughts.' }
      ]
    },
    timestamp: Date.now() - 7200000, // 2 hours ago
    mode: WritingMode.ACADEMIC,
    integrity: {
      keystrokeCount: 280,
      pasteEvents: 1,
      pasteCharacters: 42,
      averageWPM: 52,
      flagged: false,
      burstAlerts: 0
    },
    tutorSummary: "An excellent start on a challenging philosophical critique. The student displays highly creative structuring, though the second paragraph would benefit from tighter citation of active digital practices.",
    thinkingTrace: [
      { t: Date.now() - 7200000 - 900000, strokes: 0, len: 0, content: "" },
      { t: Date.now() - 7200000 - 800000, strokes: 50, len: 50, content: "Modern efficiency" },
      { t: Date.now() - 7200000 - 400000, strokes: 180, len: 210, content: "Modern efficiency is often heralded as the pinnacle of industrial progress. However, when we strip away..." }
    ]
  }
];

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole>(UserRole.STUDENT);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [guestUser, setGuestUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showDemoLogin, setShowDemoLogin] = useState(false);
  const [demoCohortCode, setDemoCohortCode] = useState('');
  const [demoError, setDemoError] = useState('');
  const [enrollmentCode, setEnrollmentCode] = useState('');
  const [onboardingError, setOnboardingError] = useState('');
  const [onboardingStep, setOnboardingStep] = useState<'CODE' | 'NAME' | 'CLASS' | 'COMPLETE'>('CODE');
  const [classPreview, setClassPreview] = useState<Classroom | null>(null);
  const [tempProfile, setTempProfile] = useState<{
    firstName: string;
    lastName: string;
    schoolId: string;
    cohortId: string;
    graduationDate: number;
    role: UserRole;
    code: string;
  } | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const lastSummarizedContent = useRef<string>('');

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      // The popup closed error is already handled in the service but we double check here
      if (err.code !== 'auth/popup-closed-by-user') {
        setAuthError(err.message);
      }
    }
  };

  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/accept-invite') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) {
        setInviteToken(token);
      }
    }
  }, []);

  const activeUser = user || guestUser;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true' && !activeUser && !loading) {
      setDemoCohortCode('ARWRIGHT');
      setShowDemoLogin(true);
    }
  }, [loading, activeUser]);

  const handleValidateCode = async () => {
    if (!user || !enrollmentCode) return;
    setOnboardingError("");
    
    try {
      // Codes are checked (and school codes applied) by the server
      const code = enrollmentCode.trim().toUpperCase();
      const response = await authedFetch('/api/onboarding/redeem-code', { code });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setOnboardingError(result.error || "An error occurred. Please try again.");
        return;
      }

      // 1. School Code (Teacher/Admin Entrance)
      if (result.type === 'school') {
        await user.getIdToken(true);
        const updatedSnap = await getDoc(doc(db, 'users', user.uid));
        const updatedProfile = updatedSnap.data() as UserProfile;
        setUserProfile(updatedProfile);
        setRole(updatedProfile.role);
        setShowOnboarding(false);
        return;
      }

      // 2. Cohort Code (Student Entrance)
      if (result.type === 'cohort') {
        setTempProfile({
          firstName: '',
          lastName: '',
          schoolId: result.schoolId,
          cohortId: result.cohortId,
          graduationDate: result.graduationDate,
          role: UserRole.STUDENT,
          code
        });
        setOnboardingStep('NAME');
        // Detached students reconnecting also go through the name step
        setShowOnboarding(true);
        return;
      }

      setOnboardingError("Invalid enrollment code. Please check with your school.");
    } catch (err) {
      console.error("Code validation error:", err);
      setOnboardingError("An error occurred. Please try again.");
    }
  };

  const handleCompleteNameEntry = async (firstName: string, lastName: string) => {
    if (!user || !tempProfile) return;
    
    try {
      setOnboardingError("");
      const userRef = doc(db, 'users', user.uid);

      // The server re-checks the cohort code and saves the profile
      const response = await authedFetch('/api/onboarding/complete-student', {
        code: tempProfile.code,
        firstName: firstName.trim(),
        lastName: lastName.trim()
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setOnboardingError(result.error || "Failed to save profile. Please try again.");
        return;
      }

      await user.getIdToken(true);
      const updatedSnap = await getDoc(userRef);
      const updatedProfile = updatedSnap.data() as UserProfile;
      setUserProfile(updatedProfile);
      setRole(updatedProfile.role);
      setOnboardingStep('CLASS');
    } catch (err) {
      console.error("Name entry error:", err);
      setOnboardingError("Failed to save profile. Please try again.");
    }
  };

  const handleJoinClassOnboarding = async (classCode: string) => {
    if (!user || !userProfile) return;
    if (!classCode) {
      setShowOnboarding(false);
      setOnboardingStep('COMPLETE');
      return;
    }

    try {
      // If we haven't previewed yet, do the school-scoped lookup
      if (!classPreview) {
        setOnboardingError("");
        const q = query(
          collection(db, 'classes'), 
          where('classCode', '==', classCode.toUpperCase()),
          where('schoolId', '==', userProfile.schoolId)
        );
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const classData = snap.docs[0].data() as Classroom;
          setClassPreview({ ...classData, id: snap.docs[0].id });
        } else {
          setOnboardingError("Class code not found in your school. You can skip this for now.");
        }
        return;
      }

      // If we are confirming the previewed class
      await updateDoc(doc(db, 'users', user.uid), {
        classIds: arrayUnion(classPreview.id)
      });
      const updatedSnap = await getDoc(doc(db, 'users', user.uid));
      setUserProfile(updatedSnap.data() as UserProfile);
      setShowOnboarding(false);
      setOnboardingStep('COMPLETE');
      setClassPreview(null);
    } catch (err) {
      console.error("Class join error:", err);
      setOnboardingError("Error joining class.");
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Roles are assigned only by the server. Ask it to create/verify this account first.
        try {
          const syncResponse = await fetch('/api/auth/sync-role', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${await u.getIdToken()}` }
          });
          if (!syncResponse.ok) throw new Error(`sync-role failed: ${syncResponse.status}`);
          // Refresh the token so it carries the role set by the server
          await u.getIdToken(true);
        } catch (syncErr) {
          console.error("Account verification failed:", syncErr);
          setAuthError("Could not verify your account. Please try again.");
          setUser(null);
          setUserProfile(null);
          await signOut(auth);
          setLoading(false);
          return;
        }

        try {
          const userRef = doc(db, 'users', u.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            let profile = userSnap.data() as UserProfile;

            // Check for graduation logic (The only automatic ALUMNUS trigger)
            const isStudentSession = profile.status === UserStatus.ACTIVE_STUDENT || profile.status === UserStatus.DETACHED_STUDENT;
            if (profile.graduationDate && Date.now() >= profile.graduationDate && isStudentSession) {
              await updateDoc(userRef, { status: UserStatus.ALUMNUS });
              profile.status = UserStatus.ALUMNUS;
            }

            // Check for archived status
            if (profile.status === UserStatus.ARCHIVED) {
              setUser(null);
              setUserProfile(null);
              signOut(auth);
              alert("Your account has been archived. Please contact support.");
              return;
            }

            setUserProfile(profile);
            setRole(profile.role);
            
            // If they are PRE_ACTIVE, show onboarding
            if (profile.status === UserStatus.PRE_ACTIVE) {
              setShowOnboarding(true);
            }
          } else {
            // The server creates the profile in /api/auth/sync-role; it should always exist here.
            throw new Error("User profile was not created");
          }
        } catch (err) {
          console.error("Error loading user profile:", err);
          setRole(UserRole.STUDENT);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  const handleGuestLogin = async (bypassCode?: string | any) => {
    const codeToUse = (typeof bypassCode === 'string' ? bypassCode : '') || demoCohortCode;
    
    if (!codeToUse || typeof codeToUse !== 'string' || !codeToUse.trim()) {
      setDemoError("Cohort Code is required for demo access.");
      return;
    }

    setDemoError("");
    setLoading(true);

    try {
      let cohortData;
      let cohortId;

      const isMasterBypass = codeToUse.toUpperCase().trim() === 'ARWRIGHT';

      if (isMasterBypass) {
        cohortData = {
          schoolId: 'demo-school-id',
          graduationDate: Date.now() + 31536000000 // 1 year
        };
        cohortId = 'demo-cohort-id';
      } else {
        try {
          const cohortsRef = collection(db, 'cohorts');
          const qCohort = query(cohortsRef, where('cohortCode', '==', codeToUse.toUpperCase().trim()));
          const cohortSnap = await getDocs(qCohort);

          if (cohortSnap.empty) {
            setDemoError("Invalid cohort code. Demo access requires a valid institution code.");
            setLoading(false);
            return;
          }

          const cohortDoc = cohortSnap.docs[0];
          cohortData = cohortDoc.data();
          cohortId = cohortDoc.id;
        } catch (dbErr) {
          console.warn("Firestore database not connected. Falling back into offline sandbox state:", dbErr);
          cohortData = {
            schoolId: 'demo-school-id',
            graduationDate: Date.now() + 31536000000 // 1 year
          };
          cohortId = 'demo-cohort-id';
        }
      }

      const demoUser = {
        uid: 'demo-user-123',
        displayName: 'Arwright Demo',
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=Arwright`,
        email: 'demo@arwright.edu'
      };
      
      const demoProfile: UserProfile = {
        uid: demoUser.uid,
        email: demoUser.email,
        displayName: demoUser.displayName,
        photoURL: demoUser.photoURL,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE_STUDENT,
        createdAt: Date.now(),
        classIds: [],
        schoolId: cohortData.schoolId,
        cohortId: cohortId,
        graduationDate: cohortData.graduationDate
      };

      setGuestUser(demoUser);
      setUserProfile(demoProfile);
      setRole(UserRole.STUDENT);
      setLoading(false);

      // Seed a submission for the demo user if it doesn't exist
      try {
        const q = query(collection(db, 'submissions'), where('studentId', '==', 'demo-user-123'), limit(1));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          await addDoc(collection(db, 'submissions'), {
            studentId: 'demo-user-123',
            studentName: 'Julian Thorne',
            document: {
              paragraphs: [
                { id: 'p1', kind: 'title', text: 'The Paradox of Modern Efficiency' },
                { id: 'p2', kind: 'body', text: 'Modern efficiency is often heralded as the pinnacle of industrial progress. However, when we strip away the machinery, we find a curious hollow at the center of human agency...' }
              ]
            },
            timestamp: Date.now() - 86400000,
            mode: WritingMode.ACADEMIC,
            integrity: {
              keystrokeCount: 120,
              pasteEvents: 1,
              pasteCharacters: 50,
              averageWPM: 45,
              flagged: true,
              burstAlerts: 2
            },
            tutorSummary: "Strong philosophical inquiry. The student engages deeply with the prompt, though the conclusion remains somewhat derivative.",
            thinkingTrace: [
              { t: Date.now() - 900000, strokes: 0, len: 0, content: "" },
              { t: Date.now() - 850000, strokes: 15, len: 15, content: "Modern efficien" },
              { t: Date.now() - 800000, strokes: 35, len: 35, content: "Modern efficiency is often heralded" },
              { t: Date.now() - 750000, strokes: 50, len: 85, content: "Modern efficiency is often heralded as the pinnacle of industrial progress. However, ", paste: 50 },
              { t: Date.now() - 700000, strokes: 70, len: 110, content: "Modern efficiency is often heralded as the pinnacle of industrial progress. However, when we strip away the ", ai: { query: "How to describe loss of agency?", focus: "Voice & Tone" } },
              { t: Date.now() - 650000, strokes: 120, len: 180, content: "Modern efficiency is often heralded as the pinnacle of industrial progress. However, when we strip away the machinery, we find a curious hollow at the center of human agency..." }
            ]
          });
        }
      } catch (seedErr) {
        console.warn("Failed to seed submissions to database, running in offline sandbox state:", seedErr);
      }
    } catch (err) {
      console.error("Demo login error:", err);
      setDemoError("Demo login failed. Check your connection.");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeUser || !userProfile) {
      setSubmissions([]);
      return;
    }

    let q = query(collection(db, 'submissions'), orderBy('timestamp', 'desc'));
    
    if (userProfile.role === UserRole.STUDENT) {
      q = query(collection(db, 'submissions'), where('studentId', '==', activeUser.uid), orderBy('timestamp', 'desc'));
    } else if (userProfile.role === UserRole.TEACHER) {
      // For now, let's just fetch all and filter or keep it simple
      // In production, we'd use where('classId', 'in', userProfile.classIds)
      // but that requires composite indexes for the orderBy
      q = query(collection(db, 'submissions'), orderBy('timestamp', 'desc'));
    }

    const unsubscribeSubmissions = onSnapshot(q, async (snapshot) => {
      let data = snapshot.docs.map(doc => {
        const d = doc.data();
        let submission = { ...d, id: doc.id } as Submission;

        // One-time client-side migration for legacy data - ONLY if current user is the owner to avoid permission errors
        if (!submission.document && (d.content || d.title) && activeUser.uid === submission.studentId) {
          const paragraphs = [];
          if (d.title) {
            paragraphs.push({ id: 'migrated-title', kind: 'title', text: d.title });
          }
          if (d.content) {
            const bodyLines = d.content.split('\n\n').filter((l: string) => l.trim().length > 0);
            bodyLines.forEach((text: string, i: number) => {
              paragraphs.push({ id: `migrated-body-${i}`, kind: 'body', text: text });
            });
          }
          submission.document = { paragraphs: paragraphs as any };
          
          // Proactively update Firestore (Self-healing system)
          updateDoc(doc.ref, { 
            document: submission.document,
            migratedAt: Date.now() 
          }).catch(console.error);
        }

        return submission;
      });

      // Client side filtering for teacher for now to avoid index creation steps during demo
      if (userProfile?.role === UserRole.TEACHER) {
        data = data.filter(s => userProfile.classIds?.includes(s.classId || '') || s.studentId === activeUser.uid);
      }

      setSubmissions(data);
    }, (error) => {
      console.error("Firestore Listen Error:", error);
      // Fallback to local offline submissions if in demo user context or when offline
      if (activeUser.uid === 'demo-user-123') {
        setSubmissions(DEFAULT_DEMO_SUBMISSIONS);
      }
    });

    return () => unsubscribeSubmissions();
  }, [activeUser]);

  const handleSaveSubmission = async (docModel: WritingDocument, integrity: IntegrityReport, mode: WritingMode, thinkingTrace: ThinkingEvent[], classId?: string) => {
    if (!activeUser) return;

    // INVARIANT CHECK: Force use of the Structured Content Model
    if (!docModel?.paragraphs || docModel.paragraphs.length === 0) {
      console.error("CRITICAL: Structural Loss Detected. Aborting save to prevent data corruption.");
      alert("Submission failed: Document structure is invalid. Please try refreshing.");
      return;
    }

    const title = docModel.paragraphs.find(p => p.kind === 'title')?.text || 'Untitled';
    const content = docModel.paragraphs.map(p => p.text).join('\n\n');

    // Check if content has changed significantly enough to warrant a new summary
    let summary = submissions.find(s => s.document?.paragraphs.find(p => p.kind === 'title')?.text === title)?.tutorSummary || "";
    let proficiencyMetrics = submissions.find(s => s.document?.paragraphs.find(p => p.kind === 'title')?.text === title)?.proficiencyMetrics || null;
    
    const contentDiff = Math.abs(content.length - lastSummarizedContent.current.length);
    if (content.trim().length > 50 && contentDiff > 40) {
      const summaryPromise = summarizeSubmissionForTeacher(content, mode, activeUser.uid);
      const metricsPromise = estimateWritingProficiency(content, mode, activeUser.uid);
      
      const [newSummary, newMetrics] = await Promise.all([summaryPromise, metricsPromise]);
      summary = newSummary;
      proficiencyMetrics = newMetrics;
      lastSummarizedContent.current = content;
    }
    
    try {
      const submissionData = {
        studentId: activeUser.uid,
        studentName: activeUser.displayName || 'Anonymous Student',
        document: docModel,
        timestamp: Date.now(),
        integrity,
        mode,
        tutorSummary: summary,
        proficiencyMetrics,
        thinkingTrace,
        classId: classId || null
      };

      await addDoc(collection(db, 'submissions'), submissionData);
    } catch (err) {
      console.error("Save Error:", err);
      alert("Error saving submission. Please check your connection.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-xs font-black uppercase tracking-widest text-stone-400">Arwright is initializing...</p>
        </div>
      </div>
    );
  }

  if (inviteToken) {
    return <AcceptInvite token={inviteToken} />;
  }

  if (!activeUser) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${isDarkMode ? 'bg-stone-950' : 'bg-[#F0F2F5]'}`}>
        <div className={`max-w-md w-full p-12 transition-all duration-500 bg-white shadow-2xl rounded-[3rem] text-center border ${isDarkMode ? 'bg-stone-900 border-stone-800 shadow-indigo-500/10' : 'bg-white border-stone-100 shadow-stone-200'}`}>
           <div className="w-20 h-20 bg-indigo-600 flex items-center justify-center rounded-3xl font-bold text-4xl text-white shadow-xl shadow-indigo-200 mx-auto mb-8 serif">A</div>
           <h1 className={`text-2xl font-black uppercase tracking-[0.2em] mb-2 ${isDarkMode ? 'text-white' : 'text-stone-900'}`}>Arwright</h1>
           <p className="text-stone-500 text-sm font-bold uppercase tracking-widest mb-10 italic">Academic Writing Mentor & Analysis</p>
           
           <div className="space-y-4">
            <button 
              onClick={handleSignIn}
              className="w-full bg-indigo-600 text-white flex items-center justify-center space-x-3 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-500 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-200"
            >
              <LogIn size={20} />
              <span>Continue with Institution</span>
            </button>

            {authError && (
              <div className="p-4 bg-rose-50/80 border border-rose-200/50 rounded-2xl text-left animate-in fade-in slide-in-from-top-1 duration-200">
                <p className="text-[10px] text-rose-500 font-black uppercase tracking-widest mb-1">Authentication Sandbox Alert</p>
                <p className="text-stone-600 text-xs leading-relaxed font-semibold">
                  {authError.includes("api-key-not-valid") || authError.includes("invalid-api-key") ? (
                    <span>
                      Firebase has not been provisioned with standard API keys yet. Please use the <strong className="text-indigo-600 font-black uppercase">Demo / Guest Access</strong> box below to enter and experience the writing platform instantly, or click "Set up Firebase" in AI Studio!
                    </span>
                  ) : (
                    authError
                  )}
                </p>
              </div>
            )}

            <div className="flex items-center my-6">
              <div className="flex-1 h-px bg-stone-100"></div>
              <span className="px-4 text-[10px] font-black text-stone-300 uppercase tracking-widest">Enrollment Required</span>
              <div className="flex-1 h-px bg-stone-100"></div>
            </div>

            {!showDemoLogin ? (
              <button 
                onClick={() => setShowDemoLogin(true)}
                className="w-full bg-stone-900 text-white flex items-center justify-center space-x-3 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-stone-800 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg"
              >
                <UserIcon size={20} />
                <span>Demo / Guest Access</span>
              </button>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <input 
                  type="text" 
                  placeholder="Enter Cohort Code"
                  className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center font-black uppercase tracking-widest placeholder:opacity-30"
                  value={demoCohortCode}
                  onChange={e => setDemoCohortCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGuestLogin()}
                  autoFocus
                />
                {demoError && <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest">{demoError}</p>}
                
                <div className="flex space-x-3">
                  <button 
                    onClick={() => {
                      setShowDemoLogin(false);
                      setDemoError("");
                    }}
                    className="flex-1 py-4 bg-stone-100 text-stone-500 rounded-2xl font-black uppercase tracking-widest hover:bg-stone-200 transition-all"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleGuestLogin}
                    className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-500 transition-all"
                  >
                    Enter Demo
                  </button>
                </div>

                <div className="pt-2">
                  <button 
                    onClick={() => {
                      setDemoCohortCode('ARWRIGHT');
                      handleGuestLogin('ARWRIGHT');
                    }}
                    className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-300 hover:text-indigo-400 transition-colors"
                  >
                    Enter Public Showcase Sandbox
                   </button>
                </div>
              </div>
            )}
           </div>

           <p className="mt-10 text-[10px] text-stone-400 font-bold uppercase tracking-wider">Students always own their writing history.</p>
        </div>
      </div>
    );
  }

  return (
    <Layout 
      role={role} 
      setRole={setRole} 
      isDarkMode={isDarkMode}
      user={activeUser}
      userProfile={userProfile}
      onLogout={() => {
        if (user) signOut(auth);
        setGuestUser(null);
        setUserProfile(null);
        setShowDemoLogin(false);
        setDemoCohortCode('');
        setDemoError('');
      }}
    >
      {/* Onboarding / Detached Reconnection Modal (Faculty and Detached Students) */}
      <AnimatePresence>
        {((showOnboarding && userProfile?.role !== UserRole.STUDENT) || (userProfile?.status === UserStatus.DETACHED_STUDENT)) && onboardingStep !== 'NAME' && onboardingStep !== 'CLASS' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white max-w-md w-full rounded-[2.5rem] p-8 shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-indigo-600">
                {userProfile?.status === UserStatus.DETACHED_STUDENT ? <LinkIcon size={40} /> : <ShieldAlert size={40} />}
              </div>
              <h2 className="text-2xl font-black text-stone-900 mb-2">
                {userProfile?.status === UserStatus.DETACHED_STUDENT ? "Reconnect Account" : "Join Your Institution"}
              </h2>
              <p className="text-stone-500 text-sm mb-8">
                {userProfile?.status === UserStatus.DETACHED_STUDENT 
                  ? "Enter a school or class code to resume full assistant access. Your writing history is safe."
                  : "Please enter the school or class code provided by your teacher or administrator."}
              </p>
              
              <div className="space-y-4">
                <input 
                  type="text" 
                  placeholder="EX: CLASS-XYZ Or OAK-1234"
                  className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center font-black uppercase tracking-widest placeholder:opacity-30"
                  value={enrollmentCode}
                  onChange={e => setEnrollmentCode(e.target.value)}
                />
                {onboardingError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">{onboardingError}</p>}
                <button 
                  onClick={handleValidateCode}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all"
                >
                  Confirm & Sync Access
                </button>
                
                {userProfile?.status === UserStatus.DETACHED_STUDENT && (
                  <div className="pt-6 border-t border-stone-100 mt-6">
                    <button className="text-[10px] font-black uppercase tracking-widest text-stone-300 hover:text-stone-500 transition-colors">
                      Ask my school about Arwright
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* Multi-Step Student Onboarding */}
        {showOnboarding && (userProfile?.status === UserStatus.PRE_ACTIVE || onboardingStep === 'NAME' || onboardingStep === 'CLASS') && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white max-w-lg w-full rounded-[3rem] shadow-2xl overflow-hidden"
            >
              {/* Step Title Area */}
              <div className="bg-stone-50 p-10 text-center border-b border-stone-100">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm text-indigo-600">
                  {onboardingStep === 'CODE' && <ShieldAlert size={32} />}
                  {onboardingStep === 'NAME' && <UserIcon size={32} />}
                  {onboardingStep === 'CLASS' && <LinkIcon size={32} />}
                </div>
                <h2 className="text-2xl font-black text-stone-900 leading-tight">
                  {onboardingStep === 'CODE' && "Induction Sequence"}
                  {onboardingStep === 'NAME' && "Identity Synthesis"}
                  {onboardingStep === 'CLASS' && "Instructional Sync"}
                </h2>
                <p className="text-stone-500 text-sm mt-1">
                  {onboardingStep === 'CODE' && "Enter your graduating class code provided by your school."}
                  {onboardingStep === 'NAME' && "Set your professional name for teacher reviews."}
                  {onboardingStep === 'CLASS' && "Join a classroom to sync with your teacher."}
                </p>
              </div>

              <div className="p-10">
                {onboardingStep === 'CODE' && (
                  <div className="space-y-6">
                    <input 
                      type="text" 
                      placeholder="EX: GRAD-2028-XYZ"
                      className="w-full px-8 py-5 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-center font-black uppercase tracking-widest text-lg"
                      value={enrollmentCode}
                      onChange={e => setEnrollmentCode(e.target.value)}
                    />
                    {onboardingError && <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest text-center">{onboardingError}</p>}
                    <button 
                      onClick={handleValidateCode}
                      className="w-full py-5 bg-stone-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-stone-800 transition-all transform active:scale-[0.98]"
                    >
                      Authenticate Cohort
                    </button>
                    <div className="pt-4 border-t border-stone-100">
                      <p className="text-[10px] text-stone-400 font-bold uppercase tracking-tighter text-center mb-1">Students: Use your Graduating Class Code.</p>
                      <p className="text-[10px] text-stone-400 font-bold uppercase tracking-tighter text-center italic">Faculty/Admins: Use your Institutional Code.</p>
                    </div>
                  </div>
                )}

                {onboardingStep === 'NAME' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2 ml-1">First Name</label>
                        <input 
                          type="text" 
                          className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold"
                          placeholder="Julian"
                          value={tempProfile?.firstName || ''}
                          onChange={e => setTempProfile(p => p ? {...p, firstName: e.target.value} : null)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2 ml-1">Last Name</label>
                        <input 
                          type="text" 
                          className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold"
                          placeholder="Thorne"
                          value={tempProfile?.lastName || ''}
                          onChange={e => setTempProfile(p => p ? {...p, lastName: e.target.value} : null)}
                        />
                      </div>
                    </div>
                    {onboardingError && <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest text-center">{onboardingError}</p>}
                    <button 
                      disabled={!tempProfile?.firstName || !tempProfile?.lastName}
                      onClick={() => handleCompleteNameEntry(tempProfile!.firstName, tempProfile!.lastName)}
                      className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                      Establish Identity
                    </button>
                  </div>
                )}

                {onboardingStep === 'CLASS' && (
                  <div className="space-y-6">
                    {!classPreview ? (
                      <>
                        <input 
                          type="text" 
                          placeholder="Teacher Code (e.g. BIO-123)"
                          className="w-full px-8 py-5 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 text-center font-black uppercase tracking-widest text-lg"
                          value={enrollmentCode}
                          onChange={e => setEnrollmentCode(e.target.value)}
                        />
                        {onboardingError && <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest text-center">{onboardingError}</p>}
                        <div className="grid grid-cols-2 gap-4">
                          <button 
                            onClick={() => handleJoinClassOnboarding('')}
                            className="py-5 bg-stone-100 text-stone-500 rounded-2xl font-black uppercase tracking-widest hover:bg-stone-200 transition-all"
                          >
                            Skip for Now
                          </button>
                          <button 
                            onClick={() => handleJoinClassOnboarding(enrollmentCode)}
                            className="py-5 bg-stone-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-stone-800 transition-all"
                          >
                            Verify Class
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-6">
                        <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 text-center">
                          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Instructional Context Meta-Data</p>
                          <h3 className="text-2xl font-black text-indigo-900 mb-1">{classPreview.name}</h3>
                          <p className="text-indigo-600/60 text-sm font-bold">Instructor: {classPreview.teacherName || "Institution Faculty"}</p>
                          {classPreview.period && (
                            <span className="inline-block mt-3 px-3 py-1 bg-white rounded-full text-[10px] font-black text-indigo-500 uppercase tracking-widest shadow-sm">
                              Session Period: {classPreview.period}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <button 
                            onClick={() => setClassPreview(null)}
                            className="py-5 bg-stone-100 text-stone-500 rounded-2xl font-black uppercase tracking-widest hover:bg-stone-200 transition-all"
                          >
                            Wrong Class
                          </button>
                          <button 
                            onClick={() => handleJoinClassOnboarding(enrollmentCode)}
                            className="py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all"
                          >
                            Confirm & Join
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {role === UserRole.STUDENT && userProfile?.cohortId ? (
        <StudentMode onSave={handleSaveSubmission} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} user={activeUser} userProfile={userProfile!} />
      ) : role === UserRole.STUDENT ? (
        <div className="h-screen flex items-center justify-center bg-stone-50">
           <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto text-stone-400 animate-pulse">
                <ShieldAlert size={32} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Cohort Verification Required</p>
           </div>
        </div>
      ) : role === UserRole.TEACHER ? (
        <TeacherMode submissions={submissions} userProfile={userProfile!} />
      ) : role === UserRole.SCHOOL_ADMIN ? (
        <SchoolAdminMode userProfile={userProfile!} />
      ) : (
        <AdminMode submissions={submissions} />
      )}
    </Layout>
  );
};

export default App;
