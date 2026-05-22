import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { getTutorFeedback, generateQuiz } from '../services/geminiService';
import { 
  IntegrityReport, WritingMode, Quiz, QuizQuestion, 
  FeedbackItem, ThinkingEvent, MentorPersonality, UserProfile, Classroom,
  WritingDocument, Paragraph, ParagraphKind, UserStatus
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, doc, updateDoc, increment, arrayUnion, onSnapshot, addDoc } from 'firebase/firestore';
import WritingEditor from './WritingEditor';
import PDFPreviewModal from './PDFPreviewModal';
import { 
  Undo, Redo, Printer, Bold, Italic, Underline, 
  AlignLeft, AlignCenter, Share2, X, Send, Sparkles, Type, 
  Keyboard, Wand2, Info, FileText, Zap, Award, Flame, CheckCircle2, AlertCircle, ArrowRight,
  Moon, Sun, BookOpen, Quote, Target, Languages, User as UserIcon, Edit3, ClipboardCheck, DoorOpen, RotateCcw,
  ShieldAlert, Camera
} from 'lucide-react';

interface StudentModeProps {
  onSave: (doc: WritingDocument, integrity: IntegrityReport, mode: WritingMode, trace: ThinkingEvent[], classId?: string) => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  user: any;
  userProfile: UserProfile;
}

const QuizView: React.FC<{ quiz: Quiz; onComplete: (score: number) => void; onCancel: () => void }> = ({ quiz, onComplete, onCancel }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);

  const question = quiz.questions[currentStep];

  const handleNext = () => {
    if (currentStep < quiz.questions.length - 1) {
      setCurrentStep(prev => prev + 1);
      setSelectedOption(null);
      setShowExplanation(false);
    } else {
      onComplete(score);
    }
  };

  const handleAnswer = (index: number) => {
    if (showExplanation) return;
    setSelectedOption(index);
    if (index === question.correctAnswer) {
      setScore(prev => prev + 1);
    }
    setShowExplanation(true);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-3xl p-8 shadow-2xl border border-stone-200 max-w-md w-full mx-auto max-h-[90vh] overflow-y-auto no-scrollbar"
    >
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600">{quiz.title}</h3>
        <button onClick={onCancel} className="text-stone-400 hover:text-stone-600"><X size={20} /></button>
      </div>
      
      <div className="mb-8">
        <div className="flex justify-between text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">
          <span>Question {currentStep + 1} of {quiz.questions.length}</span>
          <span>Score: {score}</span>
        </div>
        <div className="h-1 bg-stone-100 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-indigo-500"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / quiz.questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="mb-8">
        <p className="text-lg font-bold text-stone-800 leading-snug mb-6">{question.question}</p>
        <div className="space-y-3">
          {question.options.map((option, idx) => {
            const isCorrect = idx === question.correctAnswer;
            const isSelected = idx === selectedOption;
            
            let borderColor = 'border-stone-200';
            let bgColor = 'bg-white';
            let textColor = 'text-stone-700';

            if (showExplanation) {
              if (isCorrect) {
                borderColor = 'border-emerald-500';
                bgColor = 'bg-emerald-50';
                textColor = 'text-emerald-700';
              } else if (isSelected) {
                borderColor = 'border-rose-500';
                bgColor = 'bg-rose-50';
                textColor = 'text-rose-700';
              }
            } else if (isSelected) {
              borderColor = 'border-indigo-500';
              bgColor = 'bg-indigo-50/30';
            }

            return (
              <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                disabled={showExplanation}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${borderColor} ${bgColor} ${textColor} hover:border-indigo-300 font-medium text-sm`}
              >
                <span>{option}</span>
                {showExplanation && isCorrect && <CheckCircle2 size={16} />}
                {showExplanation && isSelected && !isCorrect && <AlertCircle size={16} />}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {showExplanation && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-stone-50 border border-stone-200 mb-6"
          >
            <p className="text-xs text-stone-600 leading-relaxed">
              <span className="font-black uppercase tracking-tighter mr-2 text-indigo-600">Context:</span>
              {question.explanation}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {showExplanation && (
        <button 
          onClick={handleNext}
          className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center space-x-2"
        >
          <span>{currentStep === quiz.questions.length - 1 ? 'Finish Challenge' : 'Next Question'}</span>
          <ArrowRight size={16} />
        </button>
      )}
    </motion.div>
  );
};

const StudentMode: React.FC<StudentModeProps> = ({ onSave, isDarkMode, setIsDarkMode, user, userProfile }) => {
  const [writingDoc, setWritingDoc] = useState<WritingDocument>(() => ({
    paragraphs: [
      { id: uuidv4(), kind: 'title', text: '' },
      { id: uuidv4(), kind: 'body', text: '' }
    ]
  }));
  const [fontSize, setFontSize] = useState(12);
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackItem[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [mode, setMode] = useState<WritingMode>(WritingMode.ACADEMIC);
  const [mentorPersonality, setMentorPersonality] = useState<MentorPersonality>(MentorPersonality.OXFORD_DON);
  const [lineSpacing, setLineSpacing] = useState(2.0); // Default to double for academic/MLA
  const [isPageView, setIsPageView] = useState(true);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Class Management State
  const [myClasses, setMyClasses] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classCode, setClassCode] = useState('');
  const [isJoiningClass, setIsJoiningClass] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [teacherPhotos, setTeacherPhotos] = useState<Record<string, string>>({}); // classId -> photoUrl
  const [classPreview, setClassPreview] = useState<Classroom | null>(null);

  useEffect(() => {
    if (!userProfile?.classIds?.length) return;
    
    // Listen to classes student is enrolled in
    const q = query(collection(db, 'classes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Classroom));
      const filtered = all.filter(c => userProfile.classIds?.includes(c.id));
      setMyClasses(filtered);
      if (!selectedClassId && filtered.length > 0) {
        setSelectedClassId(filtered[0].id);
      }
    });

    // Listen for teacher-assigned photos for this student across all their classes
    const qPhotos = query(collection(db, 'teacherPhotos'), where('studentId', '==', userProfile.uid));
    const unsubscribePhotos = onSnapshot(qPhotos, (snapshot) => {
      const photos: Record<string, string> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        photos[data.classId] = data.imageUrl;
      });
      setTeacherPhotos(photos);
    });

    return () => {
      unsubscribe();
      unsubscribePhotos();
    };
  }, [userProfile.classIds, userProfile.uid]);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classCode.trim()) return;
    setJoinError('');
    setIsJoiningClass(true);

    try {
      // If no preview yet, verify code within school
      if (!classPreview) {
        const q = query(
          collection(db, 'classes'), 
          where('classCode', '==', classCode.toUpperCase()),
          where('schoolId', '==', userProfile.schoolId)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
          setJoinError('Class code not found in your school.');
        } else {
          const classroom = snap.docs[0].data() as Classroom;
          const classId = snap.docs[0].id;

          if (userProfile.classIds?.includes(classId)) {
            setJoinError('You are already enrolled in this class.');
          } else {
            setClassPreview({ ...classroom, id: classId });
          }
        }
        return;
      }

      // If confirming the preview
      await updateDoc(doc(db, 'users', userProfile.uid), {
        classIds: arrayUnion(classPreview.id)
      });
      await updateDoc(doc(db, 'classes', classPreview.id), {
        studentCount: increment(1)
      });
      
      setIsJoinModalOpen(false);
      setClassCode('');
      setSelectedClassId(classPreview.id);
      setClassPreview(null);
    } catch (err) {
      console.error("Error joining class:", err);
      setJoinError('Authentication error. Please try again.');
    } finally {
      setIsJoiningClass(false);
    }
  };

  const isDeletingRef = useRef(false);
  const thinkingTraceRef = useRef<ThinkingEvent[]>([]);

  // Real-time Writing Support Tracking Refs and State
  const sessionStartTime = useRef(Date.now());
  const lastInputTime = useRef(Date.now());
  const deleteCount = useRef(0);
  const nudgeAlreadyShown = useRef(false);
  const originalWordCountRef = useRef(0);
  const currentWordCountRef = useRef(0);
  const [showNudge, setShowNudge] = useState(false);

  // Editor Styles State
  const [fontFamily, setFontFamily] = useState('tnr');
  const [isMLA, setIsMLA] = useState(false);
  const [textColor, setTextColor] = useState('#1c1917');
  
  // Gamification State
  const [flowScore, setFlowScore] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [isPDFPreviewOpen, setIsPDFPreviewOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState(userProfile.recoveryEmail || '');
  const [firstName, setFirstName] = useState(userProfile.firstName || '');
  const [lastName, setLastName] = useState(userProfile.lastName || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // MLA Header State
  const [mlaName, setMlaName] = useState(`${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || 'Student Scholar');
  const [mlaInstructor, setMlaInstructor] = useState('Dr. Scholarly');
  const [mlaCourse, setMlaCourse] = useState('Creative Arts & Sciences');
  
  useEffect(() => {
    const activeClass = myClasses.find(c => c.id === selectedClassId);
    if (activeClass) {
      setMlaCourse(activeClass.name);
    }
  }, [selectedClassId, myClasses]);

  // MLA Date format: 15 May 2026
  const formatDateForMLA = (date: Date) => {
    const day = date.getDate();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };
  const [mlaDate, setMlaDate] = useState(formatDateForMLA(new Date()));
  const [isTitleEditing, setIsTitleEditing] = useState(false);

  // Print Styles Injection
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        @page {
          margin: 0;
          size: auto;
        }
        body {
          background: white !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .no-print, button, nav, .sidebar, .toolbar, .gamification-bar, .masking-gutter, .page-background {
          display: none !important;
        }
        .print-document {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 1in !important;
          box-shadow: none !important;
          ring: 0 !important;
          background: white !important;
          color: black !important;
        }
        textarea {
          overflow: visible !important;
          height: auto !important;
          padding-bottom: 0 !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const sidebarWidth = isSidebarExpanded ? 500 : 340;
  
  const integrityRef = useRef<IntegrityReport>({
    keystrokeCount: 0,
    pasteEvents: 0,
    pasteCharacters: 0,
    averageWPM: 0,
    flagged: false,
    burstAlerts: 0
  });

  // Memory refs for tracking
  const writingDocRef = useRef(writingDoc);
  useEffect(() => {
    writingDocRef.current = writingDoc;
  }, [writingDoc]);

  const recordEvent = (data: Partial<ThinkingEvent> = {}) => {
    const fullText = writingDocRef.current.paragraphs.map(p => p.text).join('\n\n');
    const event: ThinkingEvent = {
      t: Date.now(),
      len: fullText.length,
      strokes: integrityRef.current.keystrokeCount,
      content: fullText, // Still recording text for trace analysis
      ...data
    };
    thinkingTraceRef.current.push(event);
  };
  
  const startTime = useRef(Date.now());
  const lastKeyTime = useRef(Date.now());

  // Handle periodic recording & flow state decay
  useEffect(() => {
    const interval = setInterval(() => {
      setFlowScore(prev => Math.max(0, prev - 2));
      
      // record current state every 30 seconds if there's content
      const hasContent = writingDocRef.current.paragraphs.some(p => p.text.trim().length > 0);
      if (hasContent) {
        recordEvent();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const [history, setHistory] = useState<WritingDocument[]>([writingDoc]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const saveToHistory = (newDoc: WritingDocument) => {
    const lastSaved = history[historyIndex];
    if (JSON.stringify(newDoc) !== JSON.stringify(lastSaved)) {
      const nextHistory = [...history.slice(0, historyIndex + 1), JSON.parse(JSON.stringify(newDoc))];
      if (nextHistory.length > 50) nextHistory.shift();
      setHistory(nextHistory);
      setHistoryIndex(nextHistory.length - 1);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevDoc = history[historyIndex - 1];
      setHistoryIndex(prev => prev - 1);
      setWritingDoc(prevDoc);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextDoc = history[historyIndex + 1];
      setHistoryIndex(prev => prev + 1);
      setWritingDoc(nextDoc);
    }
  };

  const handleDocumentChange = (newDoc: WritingDocument) => {
    setWritingDoc(newDoc);
    // Simple debounced-like check for significant changes
    if (Math.abs(JSON.stringify(newDoc).length - JSON.stringify(history[historyIndex]).length) > 50) {
      saveToHistory(newDoc);
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const toggleMLA = () => {
    if (!isMLA) {
      setFontFamily('tnr');
      setFontSize(12);
      setIsMLA(true);
    } else {
      setIsMLA(false);
    }
  };

  const requestFeedback = async (queryOverride: string = "") => {
    if (userProfile.status === UserStatus.DETACHED_STUDENT) {
      const detachedItem: FeedbackItem = {
        id: uuidv4(),
        feedback: "AI assistance is currently paused for detached accounts. Please enter a school or class code to resume.",
        focusArea: 'Access Locked',
        timestamp: Date.now()
      };
      setFeedbackHistory(prev => [detachedItem, ...prev]);
      return;
    }

    const query = queryOverride || userQuery;
    const documentText = writingDoc.paragraphs.map(p => p.text).join('\n\n');
    const titleText = writingDoc.paragraphs.find(p => p.kind === 'title')?.text || 'Untitled';

    if (!query && !documentText.trim()) return;
    
    setIsThinking(true);
    
    try {
      const result = await getTutorFeedback(documentText, `The essay title is ${titleText}`, query, mode, mentorPersonality, user?.uid);
      
      // Sometimes generate a quiz if focus is grammar or specifically requested
      let quiz = null;
      if (result.focusArea === 'Grammar & Mechanics' || Math.random() > 0.7) {
        try {
          quiz = await generateQuiz(documentText, result.focusArea, user?.uid);
        } catch (quizErr) {
          console.error('Quiz generation failed:', quizErr);
        }
      }

      const newItem: FeedbackItem = {
        id: Math.random().toString(36).substring(2, 11),
        feedback: result.feedback,
        focusArea: result.focusArea,
        suggestedExercise: result.suggestedExercise,
        timestamp: Date.now(),
        quiz: quiz || undefined
      };

      setFeedbackHistory(prev => [newItem, ...prev]);
      
      // Record AI event
      recordEvent({ ai: { query: query, focus: result.focusArea } });
      
      // Reward curiosity
      setStreakCount(prev => prev + 1);
    } catch (error) {
      console.error('AI Assistant Error:', error);
      const errorItem: FeedbackItem = {
        id: Math.random().toString(36).substring(2, 11),
        feedback: "I encountered a minor cognitive block. Please try rephrasing your request or wait a moment.",
        focusArea: 'System Notice',
        timestamp: Date.now()
      };
      setFeedbackHistory(prev => [errorItem, ...prev]);
    } finally {
      setIsThinking(false);
      setUserQuery('');
    }
  };

  const handleQuizComplete = (score: number) => {
    const pointsEarned = score * 50;
    setTotalPoints(prev => prev + pointsEarned);
    setActiveQuiz(null);
    alert(`Challenge Complete! You earned ${pointsEarned} points.`);
  };

  const dismissFeedback = (id: string) => {
    setFeedbackHistory(prev => prev.filter(item => item.id !== id));
  };

  const fullText = writingDoc.paragraphs.map(p => p.text).join('\n\n');
  const words = fullText.trim() ? fullText.trim().split(/\s+/).filter(x => x) : [];
  const wordCount = words.length;
  const charCount = fullText.length;

  // --- Real-time Writing Support / Nudge Processing ---
  const ENABLE_REALTIME_NUDGE = true;

  // Sync currentWordCountRef with actual wordCount
  useEffect(() => {
    currentWordCountRef.current = wordCount;
  }, [wordCount]);

  const shouldTriggerIntroNudge = () => {
    if (!ENABLE_REALTIME_NUDGE) return false;
    if (nudgeAlreadyShown.current) return false;

    const wordCountCurrent = wordCount;
    const sessionTimeSec = (Date.now() - sessionStartTime.current) / 1000;
    const timeSinceLastInputSec = (Date.now() - lastInputTime.current) / 1000;
    const currentDeleteCount = deleteCount.current;

    return (
      wordCountCurrent < 30 &&
      sessionTimeSec > 60 &&
      timeSinceLastInputSec > 45 &&
      currentDeleteCount >= 1
    );
  };

  const triggerNudge = async () => {
    nudgeAlreadyShown.current = true;
    setShowNudge(true);

    const countAtTrigger = wordCount;
    originalWordCountRef.current = countAtTrigger;
    const sessionTimeSec = Math.round((Date.now() - sessionStartTime.current) / 1000);
    const timeSinceLastInputSec = Math.round((Date.now() - lastInputTime.current) / 1000);
    const triggerDeleteCount = deleteCount.current;
    const eventTime = Date.now();

    // Step 6: Log the "nudge_triggered" event
    try {
      await addDoc(collection(db, 'nudge_events'), {
        userId: user?.uid || 'demo-user-123',
        eventType: "nudge_triggered",
        trigger: "intro_struggle",
        nudgeId: "intro_main_idea_v1",
        wordCount: countAtTrigger,
        sessionTime: sessionTimeSec,
        timeSinceLastInput: timeSinceLastInputSec,
        deleteCount: triggerDeleteCount,
        timestamp: eventTime
      });
    } catch (err) {
      console.error("Error logging nudge triggered event:", err);
    }

    // Step 7: Wait 60 seconds, then log the outcome event
    setTimeout(async () => {
      const finalWordCount = currentWordCountRef.current;
      const wordsAdded = finalWordCount - countAtTrigger;
      const continued = wordsAdded > 10;

      try {
        await addDoc(collection(db, 'nudge_events'), {
          userId: user?.uid || 'demo-user-123',
          eventType: "nudge_outcome",
          nudgeId: "intro_main_idea_v1",
          wordsAddedAfter: wordsAdded,
          continuedWriting: continued,
          timestamp: Date.now()
        });
      } catch (err) {
        console.error("Error logging nudge outcome event:", err);
      }
    }, 60000);
  };

  // Periodic checker to trigger nudge
  useEffect(() => {
    if (!ENABLE_REALTIME_NUDGE) return;

    const interval = setInterval(() => {
      if (shouldTriggerIntroNudge()) {
        triggerNudge();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []); // Run in background across the typing session
  // ----------------------------------------------------
  // Use pageCount from the editor instead of word-count based estimate
  const pageDisplayCount = isPageView ? activePageIndex + 1 : totalPages;

  const handleSubmission = () => {
    const totalTimeMinutes = (Date.now() - startTime.current) / 60000;
    integrityRef.current.averageWPM = Math.round(wordCount / totalTimeMinutes) || 0;
    
    // Final trace event
    recordEvent();
    
    onSave(writingDoc, { ...integrityRef.current }, mode, thinkingTraceRef.current, selectedClassId);
    alert("Submission packaged and transmitted to the instructor.");
  };

  const handleFinalSubmit = (pdfBlob: Blob, pages: number) => {
    const totalTimeMinutes = (Date.now() - startTime.current) / 60000;
    integrityRef.current.averageWPM = Math.round(wordCount / totalTimeMinutes) || 0;
    
    // Final trace event
    recordEvent();
    
    onSave(writingDoc, { ...integrityRef.current }, mode, thinkingTraceRef.current, selectedClassId);
    console.log(`PDF Submitted: ${pages} pages`, pdfBlob);
  };

  const getFocusColor = (area: string) => {
    switch (area) {
      case 'Logic & Argument': return '#6366f1';
      case 'Structure & Flow': return '#f59e0b';
      case 'Voice & Tone': return '#10b981';
      case 'Evidence & Support': return '#f43f5e';
      case 'Grammar & Mechanics': return '#8b5cf6';
      default: return '#78716c';
    }
  };

  const getFlowLevel = () => {
    if (flowScore > 80) return { label: 'In the Zone', color: 'bg-orange-500' };
    if (flowScore > 50) return { label: 'Focusing', color: 'bg-blue-500' };
    if (flowScore > 20) return { label: 'Drafting', color: 'bg-emerald-500' };
    return { label: 'Idle', color: 'bg-stone-300' };
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const updates: any = {
        recoveryEmail: recoveryEmail
      };

      // Handle name change with history
      if (firstName !== userProfile.firstName || lastName !== userProfile.lastName) {
        const oldName = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim();
        updates.firstName = firstName;
        updates.lastName = lastName;
        updates.displayName = `${firstName} ${lastName}`.trim();
        
        if (oldName) {
          updates.nameHistory = arrayUnion({
            firstName: userProfile.firstName || '',
            lastName: userProfile.lastName || '',
            changedAt: Date.now()
          });
        }
      }

      await updateDoc(doc(db, 'users', userProfile.uid), updates);
      alert("Profile updated successfully.");
      setIsProfileModalOpen(false);
    } catch (err) {
      console.error("Profile save error:", err);
      alert("Failed to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
      <div className={`flex flex-1 min-h-0 w-full overflow-hidden h-full ${isDarkMode ? 'bg-stone-950' : 'bg-stone-200/50'}`}>
        <div className={`flex-1 flex flex-col min-w-0 overflow-hidden relative transition-colors duration-300 ${isDarkMode ? 'bg-stone-950 text-white' : 'bg-stone-100 text-stone-900'}`}>
          {/* Fixed Header (Toolbar + Gamification) */}
          <div className={`flex flex-col shrink-0 z-20 ${isDarkMode ? 'bg-stone-950 shadow-lg' : 'bg-white shadow-sm ring-1 ring-stone-900/5'}`}>
          {/* Google Docs Style Toolbar */}
          <div className={`border-b px-4 py-2 flex items-center space-x-1 overflow-x-auto no-scrollbar ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'}`}>
            <div className={`p-1 mr-2 rounded-lg flex items-center space-x-1 ${isDarkMode ? 'bg-stone-800' : 'bg-stone-100'}`}>
              <button 
                onClick={handleUndo} 
                disabled={historyIndex === 0} 
                className={`p-1.5 rounded transition-all disabled:opacity-20 hover:scale-110 active:scale-95 ${isDarkMode ? 'hover:bg-stone-700 text-stone-200' : 'hover:bg-white text-stone-700 shadow-sm'}`} 
                title="Undo (Ctrl+Z)"
              >
                <Undo size={16} />
              </button>
              <button 
                onClick={handleRedo} 
                disabled={historyIndex === history.length - 1} 
                className={`p-1.5 rounded transition-all disabled:opacity-20 hover:scale-110 active:scale-95 ${isDarkMode ? 'hover:bg-stone-700 text-stone-200' : 'hover:bg-white text-stone-700 shadow-sm'}`} 
                title="Redo (Ctrl+Y)"
              >
                <Redo size={16} />
              </button>
            </div>
            <button onClick={() => window.print()} className={`p-1.5 rounded transition-colors ${isDarkMode ? 'hover:bg-stone-800 text-stone-400' : 'hover:bg-stone-100 text-stone-600'}`} title="Print"><Printer size={16} /></button>
          
          <div className={`h-6 w-px mx-1 ${isDarkMode ? 'bg-stone-800' : 'bg-stone-200'}`}></div>

          {/* Mode Controls */}
          <div className="flex items-center space-x-2">
            <select 
              value={selectedClassId}
              onChange={(e) => {
                if (e.target.value === 'new') {
                  setIsJoinModalOpen(true);
                } else {
                  setSelectedClassId(e.target.value);
                }
              }}
              className={`bg-transparent text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded outline-none border-none cursor-pointer ${isDarkMode ? 'hover:bg-stone-800 text-emerald-400' : 'hover:bg-stone-100 text-emerald-600'}`}
            >
              <option value="" disabled>Select Class</option>
              {myClasses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="new">+ Join New Class</option>
            </select>
          </div>

          <div className={`h-6 w-px mx-1 ${isDarkMode ? 'bg-stone-800' : 'bg-stone-200'}`}></div>

          <select 
            value={mode}
            onChange={(e) => setMode(e.target.value as WritingMode)}
            className={`bg-transparent text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded outline-none border-none cursor-pointer ${isDarkMode ? 'hover:bg-stone-800 text-indigo-400' : 'hover:bg-stone-100 text-indigo-600'}`}
          >
            <option value={WritingMode.ACADEMIC}>Academic</option>
            <option value={WritingMode.ANALYTICAL}>Analytical</option>
            <option value={WritingMode.ARGUMENTATIVE}>Argumentative</option>
            <option value={WritingMode.NARRATIVE}>Narrative</option>
            <option value={WritingMode.TECHNICAL}>Technical</option>
          </select>
          
          <div className={`h-6 w-px mx-1 ${isDarkMode ? 'bg-stone-800' : 'bg-stone-200'}`}></div>
          
          {/* Font Controls */}
          <select 
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className={`bg-transparent text-sm font-medium px-2 py-1 rounded outline-none border-none cursor-pointer ${isDarkMode ? 'hover:bg-stone-800 text-stone-300' : 'hover:bg-stone-100 text-stone-700'}`}
          >
            <option value="sans">Inter (Sans)</option>
            <option value="tnr">Times New Roman</option>
            <option value="serif">Georgia (Serif)</option>
            <option value="mono">JetBrains Mono</option>
          </select>
          
          <div className={`h-6 w-px mx-1 ${isDarkMode ? 'bg-stone-800' : 'bg-stone-200'}`}></div>
          
          <div className="flex items-center">
            <button 
              onClick={() => setFontSize(Math.max(8, fontSize - 1))}
              className={`px-2 py-1 rounded font-bold ${isDarkMode ? 'hover:bg-stone-800 text-stone-400' : 'hover:bg-stone-100 text-stone-600'}`}
            >
              -
            </button>
            <span className={`w-8 text-center text-sm font-medium ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}>{fontSize}</span>
            <button 
              onClick={() => setFontSize(Math.min(72, fontSize + 1))}
              className={`px-2 py-1 rounded font-bold ${isDarkMode ? 'hover:bg-stone-800 text-stone-400' : 'hover:bg-stone-100 text-stone-600'}`}
            >
              +
            </button>
          </div>

          <div className={`h-6 w-px mx-1 ${isDarkMode ? 'bg-stone-800' : 'bg-stone-200'}`}></div>

          <div className="flex items-center space-x-0.5">
            <button className={`px-2 py-1 rounded font-bold ${isDarkMode ? 'hover:bg-stone-700 text-stone-300' : 'hover:bg-stone-200 text-stone-700'}`} title="Bold"><Bold size={16} /></button>
            <button className={`px-2 py-1 rounded italic ${isDarkMode ? 'hover:bg-stone-700 text-stone-300' : 'hover:bg-stone-200 text-stone-700'}`} title="Italic"><Italic size={16} /></button>
            <button className={`px-2 py-1 rounded underline ${isDarkMode ? 'hover:bg-stone-700 text-stone-300' : 'hover:bg-stone-200 text-stone-700'}`} title="Underline"><Underline size={16} /></button>
            
            <div className="relative group ml-1">
              <button 
                className={`px-2 py-1 rounded flex flex-col items-center ${isDarkMode ? 'hover:bg-stone-800' : 'hover:bg-stone-100'}`} 
                title="Text Color"
                onClick={() => setTextColor(textColor === '#1c1917' ? '#2563eb' : '#1c1917')}
              >
                <Type size={16} style={{ color: isDarkMode && (textColor === '#1c1917' || textColor === '#1C1917') ? '#ffffff' : textColor }} />
                <div className="h-0.5 w-full mt-0.5 rounded-full" style={{ backgroundColor: isDarkMode && (textColor === '#1c1917' || textColor === '#1C1917') ? '#ffffff' : textColor }}></div>
              </button>
            </div>
          </div>

          <div className={`h-6 w-px mx-1 ${isDarkMode ? 'bg-stone-800' : 'bg-stone-200'}`}></div>

          {/* MLA Button */}
          <button 
            onClick={toggleMLA}
            className={`px-3 py-1 rounded text-[10px] font-black tracking-widest uppercase transition-all border ${isMLA ? 'bg-indigo-600 text-white border-indigo-700 shadow-inner' : isDarkMode ? 'bg-stone-800 text-stone-400 border-stone-700 hover:border-indigo-300' : 'bg-white text-stone-600 border-stone-200 hover:border-indigo-300'}`}
          >
            MLA Assist
          </button>

          <div className="flex-1 min-w-[20px]"></div>

          <button 
            onClick={toggleDarkMode}
            className={`p-1.5 rounded transition-colors mr-2 ${isDarkMode ? 'hover:bg-stone-800 text-stone-400' : 'hover:bg-stone-100 text-stone-600'}`}
            title="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
        <div className="flex items-center space-x-3">
          <div className="hidden lg:flex flex-col items-end mr-2 text-right">
             <div className="flex items-center space-x-2">
                <span className={`text-[9px] font-black uppercase tracking-[0.1em] ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>MLA Auto-Format</span>
                {userProfile.status === UserStatus.ALUMNUS && <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">Alumnus</span>}
             </div>
             <span className={`text-[8px] font-bold ${isDarkMode ? 'text-stone-600' : 'text-stone-400'}`}>Hanging indents & numbering applied at submission</span>
          </div>
          <button 
            onClick={() => setIsProfileModalOpen(true)}
            className={`p-1.5 rounded-xl transition-all border ${isDarkMode ? 'bg-stone-800 text-stone-400 border-stone-700' : 'bg-stone-100 text-stone-500 border-stone-200'} hover:scale-110`}
            title="Profile & Continuity"
          >
            <UserIcon size={18} />
          </button>
          <button 
            onClick={() => setIsPDFPreviewOpen(true)}
            className="bg-[#1a73e8] text-white px-5 py-1.5 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-[#1557b0] transition-colors flex items-center space-x-2 shadow-lg shadow-blue-500/20 whitespace-nowrap"
          >
            <ClipboardCheck size={16} />
            <span className="hidden sm:inline">Review & Submit</span>
            <span className="sm:hidden">Review</span>
          </button>
        </div>
      </div>

      {/* Gamification Bar */}
        <div className={`border-b px-6 py-2 flex items-center justify-between h-10 overflow-hidden shrink-0 ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'}`}>
          <div className="flex items-center space-x-4 flex-1 max-w-md">
            <div className={`flex items-center space-x-1.5 font-bold text-[10px] uppercase tracking-wider shrink-0 ${isDarkMode ? 'text-stone-400' : 'text-stone-500'}`}>
               <Zap size={12} className={flowScore > 50 ? 'text-blue-500' : ''} />
               <span>Flow</span>
            </div>
            <div className={`flex-1 h-2 rounded-full relative overflow-hidden ${isDarkMode ? 'bg-stone-800' : 'bg-stone-100'}`}>
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${flowScore}%` }}
                 className={`absolute inset-0 rounded-full transition-colors duration-500 ${getFlowLevel().color.replace('bg-orange-500', 'bg-blue-500')}`}
               />
            </div>
            <span className={`text-[10px] font-bold w-16 text-right uppercase tracking-tighter hidden sm:inline ${isDarkMode ? 'text-stone-600' : 'text-stone-400'}`}>
              {getFlowLevel().label}
            </span>
          </div>

          <div className={`flex items-center space-x-4 md:space-x-6 text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>
             <div className="flex items-center space-x-1.5">
               <Award size={14} className={streakCount > 0 ? 'text-amber-500' : ''} />
               <span className={streakCount > 0 ? (isDarkMode ? 'text-stone-200' : 'text-stone-700') : ''}>{totalPoints} pts</span>
             </div>
             <div className="flex items-center space-x-1.5">
               <Flame size={14} className={flowScore > 80 ? 'text-blue-600' : ''} />
               <span className={flowScore > 80 ? (isDarkMode ? 'text-stone-200' : 'text-stone-700') : ''}>Efficiency: {integrityRef.current.averageWPM} WPM</span>
             </div>
          </div>
        </div>
      </div>
      
      {/* WRITING EDITOR — Extracted logic */}
        <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden bg-stone-950/5 dark:bg-black/5">
          <AnimatePresence>
            {showNudge && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`mx-auto mt-4 max-w-xl w-full p-4 rounded-xl border flex items-start space-x-3 shadow-md z-30 transition-colors ${
                  isDarkMode 
                    ? 'bg-indigo-950/40 border-indigo-900/50 text-indigo-200' 
                    : 'bg-indigo-50/80 border-indigo-100 text-indigo-900'
                }`}
              >
                <div className="p-1 text-indigo-500 shrink-0">
                  <Sparkles size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-relaxed">
                    Try writing one sentence that captures your main idea before expanding it.
                  </p>
                </div>
                <button
                  onClick={() => setShowNudge(false)}
                  className={`p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors cursor-pointer`}
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <WritingEditor 
            document={writingDoc}
            onChange={handleDocumentChange}
            isDarkMode={isDarkMode}
            fontSize={fontSize}
            fontFamily={fontFamily}
            lineSpacing={lineSpacing}
            textColor={textColor}
            isMLA={isMLA}
            mlaName={mlaName}
            mlaInstructor={mlaInstructor}
            mlaCourse={mlaCourse}
            mlaDate={mlaDate}
            isPageView={isPageView}
            onPageChange={(active, total) => {
              setActivePageIndex(active);
              setTotalPages(total);
            }}
            onInteraction={() => {
              integrityRef.current.keystrokeCount++;
              const now = Date.now();
              const diff = now - lastKeyTime.current;
              if (diff < 50) integrityRef.current.burstAlerts++;
              setFlowScore(prev => Math.min(100, prev + 5));
              lastKeyTime.current = now;
            }}
            onPaste={(text) => {
              integrityRef.current.pasteEvents++;
              integrityRef.current.pasteCharacters += text.length;
              if (text.length > 100) integrityRef.current.flagged = true;
              setFlowScore(prev => Math.max(0, prev - 30));
              recordEvent({ paste: text.length });
            }}
            isDeletingRef={isDeletingRef}
            onKeystroke={(isDelete) => {
              lastInputTime.current = Date.now();
              if (isDelete) {
                deleteCount.current += 1;
              }
            }}
          />
        </div>

        {/* Document Metrics Status Bar */}
        <div id="status-bar" className={`h-11 border-t shrink-0 z-20 flex items-center px-6 justify-between text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-stone-900 border-stone-800 text-stone-400' : 'bg-white border-stone-200 text-stone-500 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]'}`}>

          <div className="flex items-center space-x-8">
             <div className="flex items-center space-x-2.5">
               <FileText size={12} className="text-stone-300" />
               <span>Page {activePageIndex + 1} of {totalPages}</span>
             </div>
             <div className="flex items-center space-x-8 pl-8 border-l border-stone-800/10 dark:border-stone-100/10">
               <div className="flex items-center space-x-3">
                 <span className="opacity-50">Spacing</span>
                 <div className="flex bg-stone-100 dark:bg-stone-800 rounded-lg p-0.5">
                    {[1, 1.5, 2].map(v => (
                      <button 
                        key={v}
                        onClick={() => setLineSpacing(v)}
                        className={`px-2 py-0.5 rounded-md transition-all ${lineSpacing === v ? 'bg-white dark:bg-stone-700 text-indigo-500 shadow-sm' : 'hover:text-stone-700 dark:hover:text-stone-300'}`}
                      >
                        {v === 2 ? 'Double' : v}
                      </button>
                    ))}
                 </div>
              </div>
            </div>
         </div>
         <div className="flex items-center space-x-6">
            <span className={isMLA ? 'text-indigo-500 font-bold' : ''}>{isMLA ? 'MLA Standards Applied' : 'Standard Manuscript'}</span>
            <div className="flex items-center space-x-2">
              {isThinking ? (
                <div className="flex items-center space-x-2 text-indigo-500 animate-pulse">
                  <Sparkles size={12} className="animate-spin" />
                  <span className="font-bold">Arwright is reviewing...</span>
                </div>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="opacity-60">Arwright Live Guard Enabled</span>
                </>
              )}
            </div>
         </div>
        </div>
      </div>
      {/* FLOATING UI LAYER — Highest z-index container */}
      <div className="fixed inset-0 z-[9999] pointer-events-none flex justify-end overflow-hidden">
        {/* Floating Summon Button */}
        {!isSidebarOpen && (
          <motion.button 
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.9 }}
            animate={isThinking ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
            transition={isThinking ? { repeat: Infinity, duration: 1.5 } : {}}
            onClick={() => setIsSidebarOpen(true)}
            className={`absolute bottom-8 right-8 w-16 h-16 rounded-3xl shadow-2xl flex items-center justify-center group overflow-hidden pointer-events-auto ${isThinking ? 'bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-700'} text-white transition-colors`}
          >
            <div className={`absolute inset-0 bg-gradient-to-tr opacity-50 ${isThinking ? 'from-amber-600 to-amber-300' : 'from-indigo-800 to-indigo-400'}`}></div>
            {isThinking ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2 }}><Sparkles size={24} className="relative z-10" /></motion.div> : <Wand2 size={24} className="relative z-10" />}
            {isThinking && <div className="absolute inset-0 border-4 border-white/20 rounded-3xl animate-ping text-white"></div>}
          </motion.button>
        )}

        {/* Arwright Sidebar */}
        <AnimatePresence mode="wait">
          {isSidebarOpen && (
            <motion.div 
              key="arwright-sidebar"
              initial={{ x: 500, opacity: 0 }}
              animate={{ x: 0, opacity: 1, width: isSidebarExpanded ? 500 : 340 }}
              exit={{ x: 500, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`h-full border-l flex flex-col min-h-0 overflow-hidden shadow-[-20px_0_40px_rgba(0,0,0,0.03)] shrink-0 pointer-events-auto ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'}`}
            >
              <div className={`h-12 border-b flex items-center justify-between px-5 shrink-0 ${isDarkMode ? 'bg-stone-900/50 border-stone-800' : 'bg-stone-50/50 border-stone-200'}`}>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
                      <Sparkles size={14} />
                    </div>
                    {isTitleEditing ? (
                      <div className="flex items-center space-x-2">
                        <input 
                          autoFocus
                          type="text"
                          value={writingDoc.paragraphs.find(p => p.kind === 'title')?.text || ''}
                          onChange={(e) => {
                            const newDoc = { ...writingDoc };
                            const titleIdx = newDoc.paragraphs.findIndex(p => p.kind === 'title');
                            if (titleIdx > -1) {
                              newDoc.paragraphs[titleIdx].text = e.target.value;
                            } else {
                              newDoc.paragraphs.unshift({ id: uuidv4(), kind: 'title', text: e.target.value });
                            }
                            setWritingDoc(newDoc);
                          }}
                          onBlur={() => setIsTitleEditing(false)}
                          onKeyDown={(e) => e.key === 'Enter' && setIsTitleEditing(false)}
                          className={`text-[10px] font-black tracking-[0.2em] uppercase bg-transparent border-b border-indigo-500 outline-none w-64 ${isDarkMode ? 'text-stone-100' : 'text-stone-700'}`}
                        />
                      </div>
                    ) : (
                      <span 
                        onClick={() => setIsTitleEditing(true)}
                        className={`text-[10px] font-black flex items-center space-x-2.5 tracking-[0.2em] uppercase cursor-pointer hover:text-indigo-500 transition-all rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 px-2 py-1 ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}
                      >
                        <span className="truncate max-w-[200px]">{writingDoc.paragraphs.find(p => p.kind === 'title')?.text || 'Untitled'}</span>
                        <Edit3 size={10} className="opacity-40" />
                      </span>
                    )}
                  </div>
                  <div className="h-4 w-px bg-stone-200 dark:bg-stone-800 mx-1"></div>
                  <button 
                    onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                    className={`p-1.5 rounded-lg transition-all ${isDarkMode ? 'hover:bg-stone-800 text-stone-500' : 'hover:bg-stone-200 text-stone-400'}`}
                    title={isSidebarExpanded ? "Compact View" : "Expand Focus"}
                  >
                    <ArrowRight size={14} className={`transition-transform duration-300 ${isSidebarExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-stone-800 text-stone-400 hover:text-stone-200' : 'hover:bg-stone-200 text-stone-400 hover:text-stone-600'}`}
                >
                  <X size={18} />
                </button>
              </div>

              {/* AI Scrollable Content Wrapper */}
              <div className="flex-1 overflow-y-auto min-h-0 custom-sidebar-scrollbar">
                {/* AI Input Area */}
                <div className={`p-6 border-b ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-100'}`}>
                {isMLA && (
                  <div className="mb-6 p-4 bg-indigo-50/30 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl">
                    <div className="flex items-center space-x-2 mb-3">
                      <FileText size={12} className="text-indigo-500" />
                      <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Manuscript Details</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-col">
                        <span className="text-[8px] uppercase font-black text-stone-400 mb-1">Student</span>
                        <input 
                          type="text" 
                          value={mlaName} 
                          onChange={(e) => setMlaName(e.target.value)}
                          className={`text-xs p-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner border ${isDarkMode ? 'bg-stone-900 border-stone-700 text-stone-100 placeholder-stone-600' : 'bg-white border-stone-100 text-stone-900 placeholder-stone-300'}`}
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] uppercase font-black text-stone-400 mb-1">Instructor</span>
                        <input 
                          type="text" 
                          value={mlaInstructor} 
                          onChange={(e) => setMlaInstructor(e.target.value)}
                          className={`text-xs p-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner border ${isDarkMode ? 'bg-stone-900 border-stone-700 text-stone-100 placeholder-stone-600' : 'bg-white border-stone-100 text-stone-900 placeholder-stone-300'}`}
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] uppercase font-black text-stone-400 mb-1">Class / Course</span>
                        <input 
                          type="text" 
                          value={mlaCourse} 
                          onChange={(e) => setMlaCourse(e.target.value)}
                          className={`text-xs p-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner border ${isDarkMode ? 'bg-stone-900 border-stone-700 text-stone-100 placeholder-stone-600' : 'bg-white border-stone-100 text-stone-900 placeholder-stone-300'}`}
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] uppercase font-black text-stone-400 mb-1">Date</span>
                        <input 
                          type="text" 
                          value={mlaDate} 
                          onChange={(e) => setMlaDate(e.target.value)}
                          className={`text-xs p-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-inner border ${isDarkMode ? 'bg-stone-900 border-stone-700 text-stone-100 placeholder-stone-600' : 'bg-white border-stone-100 text-stone-900 placeholder-stone-300'}`}
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-center space-x-2 mb-4">
                  <Info size={12} className="text-stone-400" />
                  <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Consult Arwright</p>
                </div>
                <div className="relative group">
                  <textarea 
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        requestFeedback();
                      }
                    }}
                    placeholder="Ask for an academic critique..."
                    className={`w-full border rounded-2xl py-4 pl-4 pr-12 text-[13px] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none placeholder-stone-400 min-h-[100px] resize-none transition-all shadow-inner ${isDarkMode ? 'bg-stone-800/50 border-stone-700 text-stone-300' : 'bg-stone-50 border-stone-200 text-stone-700'}`}
                  />
                  <button 
                    onClick={() => requestFeedback()}
                    disabled={isThinking || (!userQuery.trim() && !writingDoc.paragraphs.some(p => p.text.trim().length > 0))}
                    className="absolute right-3 bottom-3 bg-indigo-600 text-white rounded-xl p-2.5 hover:bg-indigo-700 disabled:bg-stone-200 dark:disabled:bg-stone-800 shadow-xl shadow-indigo-100 dark:shadow-none transition-all active:scale-90"
                  >
                    {isThinking ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}><Sparkles size={18} /></motion.div> : <Send size={18} />}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-5">
                  <button onClick={() => requestFeedback("Audit my structural coherence.")} className={`text-[9px] border px-3 py-2 rounded-xl transition-all font-black uppercase tracking-widest flex items-center space-x-1.5 active:scale-95 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-400 hover:text-indigo-400 hover:border-indigo-400' : 'bg-white border-stone-200 text-stone-600 hover:text-indigo-600 hover:border-indigo-400'}`}><FileText size={10} /><span>Structure</span></button>
                  <button onClick={() => requestFeedback("Audit syntax & mechanics.")} className={`text-[9px] border px-3 py-2 rounded-xl transition-all font-black uppercase tracking-widest flex items-center space-x-1.5 active:scale-95 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-400 hover:text-purple-400 hover:border-purple-400' : 'bg-white border-stone-200 text-stone-600 hover:text-purple-600 hover:border-purple-400'}`}><Languages size={10} /><span>Grammar</span></button>
                  <button onClick={() => requestFeedback("Is my tone objective?")} className={`text-[9px] border px-3 py-2 rounded-xl transition-all font-black uppercase tracking-widest flex items-center space-x-1.5 active:scale-95 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-400 hover:text-emerald-400 hover:border-emerald-400' : 'bg-white border-stone-200 text-stone-600 hover:text-emerald-600 hover:border-emerald-400'}`}><Target size={10} /><span>Tone</span></button>
                  <button onClick={() => requestFeedback("Identify potential logical fallacies.")} className={`text-[9px] border px-3 py-2 rounded-xl transition-all font-black uppercase tracking-widest flex items-center space-x-1.5 active:scale-95 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-400 hover:text-orange-400 hover:border-orange-400' : 'bg-white border-stone-200 text-stone-600 hover:text-orange-600 hover:border-orange-400'}`}><BookOpen size={10} /><span>Logic</span></button>
                  <button onClick={() => requestFeedback("Strengthen the counterargument.")} className={`text-[9px] border px-3 py-2 rounded-xl transition-all font-black uppercase tracking-widest flex items-center space-x-1.5 active:scale-95 ${isDarkMode ? 'bg-stone-800 border-stone-700 text-stone-400 hover:text-blue-400 hover:border-blue-400' : 'bg-white border-stone-200 text-stone-600 hover:text-blue-600 hover:border-blue-400'}`}><Quote size={10} /><span>Counter</span></button>
                </div>

                <div className="mt-8 pt-6 border-t border-stone-100 dark:border-stone-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <UserIcon size={12} className="text-indigo-500" />
                      <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Mentor Personality</p>
                    </div>
                    <span className="text-[8px] font-black bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 px-2 py-0.5 rounded-full">New</span>
                  </div>
                  <select 
                    value={mentorPersonality}
                    onChange={(e) => setMentorPersonality(e.target.value as MentorPersonality)}
                    className={`w-full text-xs p-3 rounded-2xl border outline-none shadow-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer ${isDarkMode ? 'bg-stone-800/80 border-stone-600 text-stone-200 hover:border-indigo-400' : 'bg-white border-stone-300 text-stone-800 hover:border-indigo-400 font-medium'}`}
                  >
                    <option value={MentorPersonality.OXFORD_DON}>The Oxford Don (Sharp & Witty)</option>
                    <option value={MentorPersonality.SUPPORTIVE_COACH}>The Supportive Coach (Warm & Kind)</option>
                    <option value={MentorPersonality.TECHNICAL_ARCHITECT}>The Technical Architect (Precise & Objective)</option>
                    <option value={MentorPersonality.CREATIVE_CATALYST}>The Creative Catalyst (Inspiring & Visionary)</option>
                  </select>
                  <p className={`mt-3 text-[9px] leading-relaxed italic ${isDarkMode ? 'text-stone-500' : 'text-stone-400'}`}>
                    {mentorPersonality === MentorPersonality.OXFORD_DON && "Expect rigorous critiques delivered with a side of sophisticated sarcasm."}
                    {mentorPersonality === MentorPersonality.SUPPORTIVE_COACH && "A gentle guide focused on your growth and building your confidence."}
                    {mentorPersonality === MentorPersonality.TECHNICAL_ARCHITECT && "A clinical approach focused on efficiency, logic, and structural integrity."}
                    {mentorPersonality === MentorPersonality.CREATIVE_CATALYST && "Focuses on the soul of your writing, pushing you to explore expressive depth."}
                  </p>
                </div>
              </div>

                {/* Feedback Feed */}
                <div className={`p-6 space-y-5 ${isDarkMode ? 'bg-stone-900/50' : 'bg-[#FBFBFC]'}`}>
                {isThinking && (
                  <div className={`border p-6 rounded-3xl flex flex-col items-center justify-center space-y-4 shadow-sm animate-pulse ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-100'}`}>
                     <div className={`w-12 h-12 rounded-full flex items-center justify-center text-indigo-500 ${isDarkMode ? 'bg-indigo-900/20' : 'bg-indigo-50'}`}>
                       <Sparkles size={24} />
                     </div>
                     <span className="text-[10px] text-stone-400 font-black uppercase tracking-[0.3em]">Decoding Draft...</span>
                  </div>
                )}

                {feedbackHistory.length === 0 && !isThinking ? (
                  <div className="text-center py-24 px-8 opacity-40">
                     <Sparkles size={32} className={`mx-auto mb-6 ${isDarkMode ? 'text-stone-700' : 'text-stone-300'}`} />
                     <p className="text-[11px] text-stone-500 font-bold uppercase tracking-widest">
                       Dialogue Pending
                     </p>
                  </div>
                ) : (
                  feedbackHistory.map(item => (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      key={item.id} 
                      className={`border p-5 rounded-3xl shadow-sm group relative border-l-4 hover:shadow-md transition-all ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200/50'}`}
                      style={{ borderLeftColor: getFocusColor(item.focusArea) }}
                    >
                      <button 
                        onClick={() => dismissFeedback(item.id)}
                        className={`absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full shadow-lg border ${isDarkMode ? 'bg-stone-800 text-stone-400 hover:text-stone-200 border-stone-700' : 'bg-white text-stone-400 hover:text-stone-600 border-stone-100'}`}
                      >
                        <X size={14} />
                      </button>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">{item.focusArea}</span>
                        </div>
                        <span className="text-[8px] text-stone-300 font-mono">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className={`text-[14px] leading-relaxed font-serif italic ${isDarkMode ? 'text-stone-200' : 'text-stone-800'}`}>
                        "{item.feedback}"
                      </p>
                      {item.suggestedExercise && (
                        <div className={`mt-5 pt-5 border-t ${isDarkMode ? 'border-stone-800' : 'border-stone-50'}`}>
                          <div className="flex items-center space-x-2 mb-2">
                            <Award size={12} className="text-amber-500" />
                            <span className={`text-[9px] font-black uppercase tracking-tighter block ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>Strategy</span>
                          </div>
                          <p className={`text-[12px] leading-relaxed ${isDarkMode ? 'text-stone-400' : 'text-stone-600'}`}>
                            {item.suggestedExercise}
                          </p>
                        </div>
                      )}
                      {item.quiz && (
                        <button 
                          onClick={() => setActiveQuiz(item.quiz!)}
                          className={`mt-4 w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center space-x-2 group/btn ${isDarkMode ? 'bg-stone-800 text-white hover:bg-indigo-600' : 'bg-stone-900 text-white hover:bg-indigo-600'}`}
                        >
                          <Zap size={12} />
                          <span>Level Up Challenge</span>
                        </button>
                      )}
                    </motion.div>
                  ))
                )}
                </div>
              </div>

              {/* Footer Stats */}
              <div className={`p-6 border-t shrink-0 ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'}`}>
                <div className="grid grid-cols-2 gap-3">
                   <div className={`p-4 rounded-2xl border flex flex-col items-center ${isDarkMode ? 'bg-stone-800/50 border-stone-800' : 'bg-stone-50 border-stone-100'}`}>
                      <Keyboard size={14} className={`mb-2 ${isDarkMode ? 'text-stone-600' : 'text-stone-300'}`} />
                      <div className={`text-xl font-black tracking-tighter ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}>{integrityRef.current.keystrokeCount}</div>
                      <span className="text-[8px] text-stone-400 font-black uppercase tracking-widest mt-1">Strokes</span>
                   </div>
                   <div className={`p-4 rounded-2xl border flex flex-col items-center ${isDarkMode ? 'bg-stone-800/50 border-stone-800' : 'bg-stone-50 border-stone-100'}`}>
                      <Flame size={14} className={`mb-2 ${isDarkMode ? 'text-blue-500/50' : 'text-blue-300'}`} />
                      <div className={`text-xl font-black tracking-tighter ${isDarkMode ? 'text-stone-300' : 'text-stone-700'}`}>{totalPoints}</div>
                      <span className="text-[8px] text-stone-400 font-black uppercase tracking-widest mt-1">Points</span>
                   </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Profile & Continuity Modal */}
      <AnimatePresence>
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-[10000] bg-stone-900/60 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                  <div className="relative group">
                    <img 
                      src={teacherPhotos[selectedClassId] || userProfile.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.uid}`} 
                      className="w-12 h-12 rounded-2xl shadow-md border-2 border-white" 
                      alt="" 
                    />
                    {teacherPhotos[selectedClassId] && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 rounded-full border-2 border-white flex items-center justify-center" title="Institutional Identity Photo">
                        <Camera size={8} className="text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-black text-stone-900 text-lg">Student Profile</h3>
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{userProfile.status}</p>
                  </div>
                </div>
                <button onClick={() => setIsProfileModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-stone-50 rounded-3xl border border-stone-100 space-y-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Edit3 size={14} className="text-indigo-500" />
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Professional Identity</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[8px] font-black uppercase text-stone-400 mb-1 ml-1">First Name</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-3 bg-white border border-stone-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 text-sm font-medium"
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black uppercase text-stone-400 mb-1 ml-1">Last Name</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-3 bg-white border border-stone-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 text-sm font-medium"
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-[9px] text-stone-400 italic">Identity changes are logged to maintain institutional continuity.</p>
                </div>

                {Object.keys(teacherPhotos).length > 0 && (
                  <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100">
                    <div className="flex items-center space-x-2 mb-4">
                      <Camera size={14} className="text-indigo-500" />
                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Classroom Identities</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {Object.entries(teacherPhotos).map(([cid, url]) => (
                        <div key={cid} className="flex flex-col items-center space-y-1">
                          <img src={url} className="w-10 h-10 rounded-xl border border-stone-200 shadow-sm" alt="" />
                          <span className="text-[7px] font-black uppercase text-stone-400 truncate w-full text-center">
                            {myClasses.find(c => c.id === cid)?.name || 'Class'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[8px] text-stone-400 mt-4 italic">Teachers may assign classroom-specific photos for recognition.</p>
                  </div>
                )}

                <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100">
                  <div className="flex items-center space-x-2 mb-2">
                    <ShieldAlert size={14} className="text-indigo-500" />
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Account Continuity</span>
                  </div>
                  <p className="text-[11px] text-stone-500 leading-relaxed mb-4">
                    Add a recovery email to ensure you never lose access to your writing history if your school account is revoked.
                  </p>
                  <input 
                    type="email" 
                    placeholder="Personal email"
                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm font-medium"
                    value={recoveryEmail}
                    onChange={e => setRecoveryEmail(e.target.value)}
                  />
                  <p className="text-[9px] text-stone-400 font-bold uppercase mt-2">Never visible to teachers • Secure only</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 text-center">
                    <span className="text-[8px] font-black text-stone-400 uppercase block mb-1">Affiliation</span>
                    <span className="text-xs font-black text-stone-700 truncate block">
                      {userProfile.schoolId ? "School Member" : "Independent"}
                    </span>
                  </div>
                  <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 text-center">
                    <span className="text-[8px] font-black text-stone-400 uppercase block mb-1">AI Assistant</span>
                    <span className={`text-xs font-black ${userProfile.status === UserStatus.DETACHED_STUDENT ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {userProfile.status === UserStatus.DETACHED_STUDENT ? 'Paused' : 'Active'}
                    </span>
                  </div>
                </div>

                <button 
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="w-full py-4 bg-stone-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-stone-800 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {isSavingProfile ? <RotateCcw size={18} className="animate-spin" /> : <span>Update Profile</span>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Join Class Modal */}
      <AnimatePresence>
        {isJoinModalOpen && (
          <div className="fixed inset-0 z-[10000] bg-stone-900/60 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-16 h-16 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-600">
                <DoorOpen size={32} />
              </div>
              <h2 className="text-2xl font-black text-stone-900 mb-2 tracking-tight">Enter Classroom</h2>
              <p className="text-stone-500 text-xs mb-8 leading-relaxed font-bold uppercase tracking-wider">Secure Enrollment Protocol</p>
              
              <form onSubmit={handleJoinClass} className="space-y-4">
                {!classPreview ? (
                  <>
                    <input 
                      type="text" 
                      placeholder="CLASS CODE"
                      className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-center font-black uppercase tracking-[0.2em] text-indigo-600"
                      value={classCode}
                      onChange={e => setClassCode(e.target.value)}
                      maxLength={10}
                    />
                    {joinError && <p className="text-rose-500 text-[10px] font-black uppercase tracking-widest">{joinError}</p>}
                    
                    <div className="flex flex-col space-y-3 pt-2">
                      <button 
                        type="submit"
                        disabled={isJoiningClass || !classCode.trim()}
                        className="w-full py-4 bg-stone-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-stone-800 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                      >
                        {isJoiningClass ? <RotateCcw size={18} className="animate-spin" /> : <span>Verify Code</span>}
                      </button>
                      <button 
                        type="button"
                        onClick={() => setIsJoinModalOpen(false)}
                        className="w-full py-4 bg-white text-stone-400 rounded-2xl font-black uppercase tracking-widest hover:text-stone-600 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 text-center">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Found Context</p>
                      <h3 className="text-xl font-black text-indigo-900 mb-1">{classPreview.name}</h3>
                      <p className="text-indigo-600/60 text-[11px] font-bold">Faculty: {classPreview.teacherName}</p>
                      {classPreview.period && (
                        <span className="inline-block mt-3 px-3 py-1 bg-white rounded-full text-[9px] font-black text-indigo-500 uppercase tracking-widest shadow-sm">
                          Period: {classPreview.period}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col space-y-3">
                      <button 
                        type="submit"
                        disabled={isJoiningClass}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                      >
                        {isJoiningClass ? <RotateCcw size={18} className="animate-spin" /> : <span>Confirm & Enroll</span>}
                      </button>
                      <button 
                        type="button"
                        onClick={() => setClassPreview(null)}
                        className="w-full py-4 bg-stone-100 text-stone-500 rounded-2xl font-black uppercase tracking-widest hover:bg-stone-200 transition-all"
                      >
                        Search Again
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quiz Overlay */}
      <AnimatePresence>
        {activeQuiz && (
          <div className="fixed inset-0 bg-stone-900/60 dark:bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6 overflow-y-auto">
            <QuizView 
              quiz={activeQuiz} 
              onComplete={handleQuizComplete} 
              onCancel={() => setActiveQuiz(null)} 
            />
          </div>
        )}
      </AnimatePresence>

      {/* PDF Preview Modal */}
      <PDFPreviewModal 
        isOpen={isPDFPreviewOpen}
        onClose={() => setIsPDFPreviewOpen(false)}
        onSubmit={handleFinalSubmit}
        document={writingDoc}
        mlaName={mlaName}
        mlaInstructor={mlaInstructor}
        mlaCourse={mlaCourse}
        mlaDate={mlaDate}
        isDarkMode={isDarkMode}
        isMLA={isMLA}
        fontFamily={fontFamily}
        fontSize={fontSize}
        lineSpacing={lineSpacing}
        textColor={textColor}
      />
    </div>
  );
};

export default StudentMode;
