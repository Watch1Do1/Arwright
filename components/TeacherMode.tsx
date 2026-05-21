
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Search, ShieldAlert, ShieldCheck, Zap, 
  ExternalLink, Download, GraduationCap, BarChart3, 
  FileText, History, Clock, ArrowRight, Sparkles,
  Play, Pause, RotateCcw, Activity, Plus, X, Copy, CheckCircle2,
  Trash2, Globe, LayoutDashboard, DoorOpen, Camera, Info
} from 'lucide-react';
import { Submission, ThinkingEvent, Classroom, UserRole, UserProfile, UserStatus } from '../types';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, setDoc, getDocs, increment } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DraftEvolutionReplayProps {
  trace: ThinkingEvent[];
  studentName: string;
  onClose: () => void;
}

const DraftEvolutionReplay: React.FC<DraftEvolutionReplayProps> = ({ trace, studentName, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const currentEvent = trace[currentIndex];

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= trace.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, trace.length]);

  const stats = useMemo(() => {
    const totalDuration = trace.length > 0 ? trace[trace.length - 1].t - trace[0].t : 0;
    const aiInteractions = trace.filter(e => e.ai).length;
    const pasteEvents = trace.filter(e => e.paste).length;
    return { totalDuration, aiInteractions, pasteEvents };
  }, [trace]);

  if (!trace || trace.length === 0) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-stone-900/95 backdrop-blur-md flex flex-col p-8"
    >
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <Activity size={20} className="text-indigo-400" />
            <h2 className="text-xl font-black text-white uppercase tracking-[0.2em]">Draft Evolution Replay</h2>
          </div>
          <p className="text-stone-400 text-xs font-bold uppercase tracking-widest">
            Observation of {studentName}'s cognitive sequence
          </p>
        </div>
        <button 
          onClick={onClose}
          className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-2xl transition-all"
        >
          <RotateCcw size={20} />
        </button>
      </div>

      <div className="flex-1 flex gap-8 overflow-hidden">
         {/* The Reconstructed Paper */}
         <div className="flex-1 flex flex-col items-center overflow-auto no-scrollbar py-10 bg-stone-800">
           <div className="w-[816px] min-h-[1056px] bg-white rounded-sm shadow-2xl relative overflow-hidden flex flex-col shrink-0">
             <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-500 opacity-20"></div>
             <div className="flex-1 p-[96px] font-tnr text-lg leading-[1.8] text-stone-800 whitespace-pre-wrap">
               {currentEvent.content || "Initial stage..."}
             </div>
           </div>
         </div>

        {/* Replay Dashboard */}
        <div className="w-80 flex flex-col space-y-6">
          <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1">Total Effort</span>
                <span className="text-2xl font-black text-white tracking-tighter">{currentEvent.strokes} <span className="text-xs text-stone-500">Strokes</span></span>
              </div>
              <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400">
                <Zap size={20} />
              </div>
            </div>

            <div className="h-px bg-white/10"></div>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-stone-400">
                <span>Timestamp</span>
                <span className="text-white font-mono">{new Date(currentEvent.t).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-stone-400">
                <span>Timeline Event</span>
                {currentEvent.paste ? (
                  <span className="text-rose-400 flex items-center space-x-1"><ShieldAlert size={10} /> <span>Paste ({currentEvent.paste}ch)</span></span>
                ) : currentEvent.ai ? (
                  <span className="text-indigo-400 flex items-center space-x-1"><Sparkles size={10} /> <span>Consultation</span></span>
                ) : (
                  <span className="text-emerald-400">Continuous Flow</span>
                )}
              </div>
            </div>

            {currentEvent.ai && (
              <div className="mt-4 p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center space-x-2">
                  <Sparkles size={10} />
                  <span>AI Inquiry</span>
                </p>
                <p className="text-[11px] text-stone-300 italic">"{currentEvent.ai.query}"</p>
              </div>
            )}
          </div>

          <div className="flex-1 bg-white/5 border border-white/10 p-6 rounded-[2rem] overflow-hidden flex flex-col">
            <div className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-4">Event Log</div>
            <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar">
              {trace.slice(0, currentIndex + 1).reverse().map((event, i) => (
                <div key={i} className="flex items-start space-x-3 opacity-60">
                   <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${event.paste ? 'bg-rose-500' : event.ai ? 'bg-indigo-500' : 'bg-stone-500'}`}></div>
                   <div className="flex flex-col">
                      <span className="text-[9px] font-mono text-stone-500">{new Date(event.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      <span className="text-[10px] text-stone-300">
                        {event.paste ? `Insert (${event.paste} ch)` : event.ai ? `AI: ${event.ai.focus}` : `Content Level: ${event.len}ch`}
                      </span>
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Controls */}
      <div className="mt-8 bg-white/5 border border-white/10 p-8 rounded-[3rem]">
        <div className="flex items-center space-x-6 mb-4">
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-12 h-12 bg-white text-stone-950 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl shadow-white/10"
          >
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          
          <div className="flex-1 relative pb-6">
            <input 
              type="range"
              min="0"
              max={trace.length - 1}
              value={currentIndex}
              onChange={(e) => {
                setCurrentIndex(parseInt(e.target.value));
                setIsPlaying(false);
              }}
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-indigo-500"
            />
            {/* Timeline Markers */}
            <div className="absolute w-full h-1 mt-4 flex">
              {trace.map((e, i) => (
                (e.paste || e.ai) && (
                  <div 
                    key={i}
                    className={`absolute w-1 h-3 -mt-1 rounded-full ${e.paste ? 'bg-rose-500' : 'bg-indigo-500'}`}
                    style={{ left: `${(i / (trace.length - 1)) * 100}%` }}
                  ></div>
                )
              ))}
            </div>
          </div>
          
          <div className="text-[10px] font-black text-stone-500 uppercase tracking-widest w-24 text-right">
            Sequence: {currentIndex + 1} / {trace.length}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

interface TeacherModeProps {
  submissions: Submission[];
  userProfile: UserProfile;
}

const TeacherMode: React.FC<TeacherModeProps> = ({ submissions, userProfile }) => {
  const [activeTab, setActiveTab] = useState<'submissions' | 'classes'>('submissions');
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(submissions[0]?.id || null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [newClass, setNewClass] = useState({ name: '', gradeLevel: '', period: '', expirationDays: '180' });
  const [copiedClassId, setCopiedClassId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | 'all'>('all');

  // Student Identity Management State
  const [classStudents, setClassStudents] = useState<UserProfile[]>([]);
  const [studentPhotos, setStudentPhotos] = useState<Record<string, string>>({}); // studentId -> imageUrl
  const [isAssigningPhoto, setIsAssigningPhoto] = useState<string | null>(null); // studentId
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [isManagingRosterId, setIsManagingRosterId] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile.uid) return;
    const q = query(collection(db, 'classes'), where('teacherId', '==', userProfile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClasses(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Classroom)));
    });
    return unsubscribe;
  }, [userProfile.uid]);

  useEffect(() => {
    const activeClassId = isManagingRosterId || (selectedClassId !== 'all' ? selectedClassId : null);

    if (!activeClassId) {
      setClassStudents([]);
      setStudentPhotos({});
      return;
    }

    // 1. Fetch Students in Class
    const qStudents = query(collection(db, 'users'), where('classIds', 'array-contains', activeClassId));
    const unsubscribeStudents = onSnapshot(qStudents, (snapshot) => {
      setClassStudents(snapshot.docs.map(d => d.data() as UserProfile));
    });

    // 2. Fetch Teacher-Assigned Photos
    const qPhotos = query(collection(db, 'teacherPhotos'), where('classId', '==', activeClassId));
    const unsubscribePhotos = onSnapshot(qPhotos, (snapshot) => {
      const photos: Record<string, string> = {};
      snapshot.docs.forEach(d => {
        const data = d.data();
        photos[data.studentId] = data.imageUrl;
      });
      setStudentPhotos(photos);
    });

    return () => {
      unsubscribeStudents();
      unsubscribePhotos();
    };
  }, [selectedClassId, isManagingRosterId]);

  const handleAssignPhoto = async () => {
    if (!isAssigningPhoto || !selectedClassId || selectedClassId === 'all') return;
    try {
      const docId = `${selectedClassId}_${isAssigningPhoto}`;
      await setDoc(doc(db, 'teacherPhotos', docId), {
        classId: selectedClassId,
        studentId: isAssigningPhoto,
        imageUrl: photoUrlInput,
        teacherId: userProfile.uid,
        assignedAt: Date.now()
      });
      setIsAssigningPhoto(null);
      setPhotoUrlInput('');
    } catch (err) {
      console.error("Error assigning photo:", err);
    }
  };

  const handleRemoveStudentFromClass = async (studentId: string, classId: string) => {
    if (!window.confirm("Remove this student from the class? Their submissions will remain but they will no longer be part of this classroom context.")) return;
    try {
      await updateDoc(doc(db, 'users', studentId), {
        classIds: arrayRemove(classId)
      });
      await updateDoc(doc(db, 'classes', classId), {
        studentCount: increment(-1)
      });
      // Also cleanup teacher-assigned photo for this context
      await deleteDoc(doc(db, 'teacherPhotos', `${classId}_${studentId}`));
    } catch (err) {
      console.error("Error removing student:", err);
    }
  };

  const handleInitiateIntegrityReview = async (submission: Submission) => {
    if (isReviewing) return;
    
    // Check if review already exists to avoid redundant calls if teacher just wants to view
    if (submission.integrityReview) return;

    setIsReviewing(true);
    try {
      // Get historical submissions for this student to provide context
      const historical = submissions.filter(s => 
        s.studentId === submission.studentId && 
        s.id !== submission.id && 
        s.timestamp < submission.timestamp
      ).slice(0, 5); // Limit to last 5 for context

      const response = await fetch('/api/integrity-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission, historicalSubmissions: historical })
      });

      if (!response.ok) throw new Error("API failed");
      const reviewData = await response.json();

      // Save review to Firestore
      await updateDoc(doc(db, 'submissions', submission.id), {
        integrityReview: reviewData
      });

      // Update local state if needed (though onSnapshot should catch it)
    } catch (err) {
      console.error("Integrity review error:", err);
      alert("Failed to initiate review. Please ensure your environment is configured.");
    } finally {
      setIsReviewing(false);
    }
  };

  const generateClassCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClass.name) return;

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(newClass.expirationDays));

      // Uniqueness check for classCode within school
      let uniqueCode = '';
      let isUnique = false;
      let attempts = 0;
      const schoolId = userProfile.schoolId || 'unassigned';

      while (!isUnique && attempts < 5) {
        uniqueCode = generateClassCode();
        const q = query(
          collection(db, 'classes'), 
          where('schoolId', '==', schoolId),
          where('classCode', '==', uniqueCode)
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        alert("System encountered a collision in class code generation. Please try again.");
        return;
      }

      const docRef = await addDoc(collection(db, 'classes'), {
        ...newClass,
        teacherId: userProfile.uid,
        teacherName: userProfile.displayName,
        schoolId: schoolId,
        classCode: uniqueCode,
        studentCount: 0,
        createdAt: Date.now(),
        expiresAt: expiresAt.getTime()
      });

      // Update teacher profile
      await updateDoc(doc(db, 'users', userProfile.uid), {
        classIds: arrayUnion(docRef.id)
      });

      setIsAddingClass(false);
      setNewClass({ name: '', gradeLevel: '', period: '', expirationDays: '180' });
    } catch (err) {
      console.error("Error adding class:", err);
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!window.confirm("Are you sure? This will not delete submissions but students will lose their class association.")) return;
    try {
      await deleteDoc(doc(db, 'classes', id));
      await updateDoc(doc(db, 'users', userProfile.uid), {
        classIds: arrayRemove(id)
      });
    } catch (err) {
      console.error("Error deleting class:", err);
    }
  };

  const copyClassCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedClassId(id);
    setTimeout(() => setCopiedClassId(null), 2000);
  };

  const filteredSubmissions = useMemo(() => {
    if (selectedClassId === 'all') return submissions;
    return submissions.filter(s => s.classId === selectedClassId);
  }, [submissions, selectedClassId]);

  const selected = filteredSubmissions.find(s => s.id === selectedId);

  useEffect(() => {
    if (selected && !selected.document && (selected as any).content) {
      console.warn(`[Compatibility Fallback] Submission ${selected.id} is missing a structured document. Rendering from content string.`);
    }
  }, [selected]);

  const statsData = filteredSubmissions.map(s => ({
    name: s.studentName,
    transparency: s.integrity.flagged ? 40 : 100,
    wpm: s.integrity.averageWPM
  }));

  return (
    <div className="flex h-full bg-[#F0F2F5] overflow-hidden">
      {/* Navigation Rail */}
      <div className="w-20 bg-stone-900 flex flex-col items-center py-8 space-y-8">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
          <GraduationCap size={24} />
        </div>
        <div className="flex-1 flex flex-col space-y-4">
          <button 
            onClick={() => setActiveTab('submissions')}
            className={`p-4 rounded-2xl transition-all ${activeTab === 'submissions' ? 'bg-white/10 text-white' : 'text-stone-500 hover:text-stone-300 hover:bg-white/5'}`}
            title="Submissions"
          >
            <FileText size={20} />
          </button>
          <button 
            onClick={() => setActiveTab('classes')}
            className={`p-4 rounded-2xl transition-all ${activeTab === 'classes' ? 'bg-white/10 text-white' : 'text-stone-500 hover:text-stone-300 hover:bg-white/5'}`}
            title="Classes"
          >
            <DoorOpen size={20} />
          </button>
        </div>
      </div>

      {activeTab === 'submissions' ? (
        <>
          {/* Sidebar List */}
          <div className="w-80 bg-white border-r border-stone-200 flex flex-col overflow-hidden shadow-sm">
            <div className="p-6 border-b border-stone-100 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <LayoutDashboard size={14} className="text-indigo-600" />
                  <h2 className="font-black text-stone-700 uppercase tracking-widest text-[10px]">Registry</h2>
                </div>
                <span className="bg-stone-100 text-stone-500 text-[10px] px-2 py-0.5 rounded-full font-bold">{filteredSubmissions.length}</span>
              </div>
              
              <select 
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-stone-500 outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">All Classes</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {filteredSubmissions.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center">
                  <History size={32} className="text-stone-200 mb-4" />
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">No Submissions</p>
                </div>
              ) : (
                filteredSubmissions.map(sub => {
                  const studentProfile = classStudents.find(s => s.uid === sub.studentId);
                  const hasNameChange = studentProfile?.nameHistory && studentProfile.nameHistory.length > 1;
                  const displayAvatar = studentPhotos[sub.studentId] || studentProfile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sub.studentId}`;

                  return (
                    <button
                      key={sub.id}
                      onClick={() => setSelectedId(sub.id)}
                      className={`w-full text-left p-5 transition-all border-b border-stone-50 group flex items-start space-x-4 ${selectedId === sub.id ? 'bg-indigo-50/50' : 'hover:bg-stone-50'}`}
                    >
                      <div className="relative">
                        <img src={displayAvatar} className="w-10 h-10 rounded-xl shadow-sm" alt="" />
                        {hasNameChange && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white flex items-center justify-center" title="Identity Update Detected">
                            <History size={6} className="text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-[13px] font-bold truncate transition-colors ${selectedId === sub.id ? 'text-indigo-700' : 'text-stone-700'}`}>
                            {sub.studentName}
                          </span>
                          {sub.integrity.flagged ? (
                            <ShieldAlert size={14} className="text-rose-500 shrink-0" />
                          ) : (
                            <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] text-stone-400 truncate opacity-80">
                          {sub.document?.paragraphs.find(p => p.kind === 'title')?.text || sub.title || 'Untitled'}
                        </div>
                        <div className="flex items-center space-x-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tighter">View Analysis</span>
                          <ArrowRight size={10} className="text-indigo-600" />
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Detail Panel */}
          <div className="flex-1 overflow-y-auto p-10 bg-[#F8F9FA]">
            {selected ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            key={selected.id}
            className="max-w-5xl mx-auto space-y-10"
          >
            <div className="flex justify-between items-start">
              <div>
                <motion.h1 
                  layoutId="title"
                  className="serif text-4xl font-bold text-stone-900 mb-3 tracking-tight"
                >
                  {selected.document?.paragraphs.find(p => p.kind === 'title')?.text || selected.title || 'Untitled'}
                </motion.h1>
                <div className="flex items-center space-x-3 text-stone-500 font-bold text-[11px] uppercase tracking-widest">
                   <div className="flex items-center space-x-2">
                     <div className="relative group">
                       <img 
                        src={studentPhotos[selected.studentId] || classStudents.find(s => s.uid === selected.studentId)?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selected.studentId}`} 
                        className="w-8 h-8 rounded-lg shadow-sm border border-stone-200" 
                        alt="" 
                       />
                       <button 
                        onClick={() => setIsAssigningPhoto(selected.studentId)}
                        className="absolute inset-0 bg-stone-900/60 text-white rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                       >
                         <Camera size={12} />
                       </button>
                     </div>
                     <div className="flex flex-col">
                        <div className="flex items-center space-x-2">
                          <span className="text-stone-800">{selected.studentName}</span>
                          {classStudents.find(s => s.uid === selected.studentId)?.nameHistory && classStudents.find(s => s.uid === selected.studentId)!.nameHistory!.length > 1 && (
                            <div className="group relative">
                              <Info size={12} className="text-indigo-500 cursor-help" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-stone-900 text-white text-[10px] rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                <p className="font-black mb-1">Identity Update History</p>
                                {classStudents.find(s => s.uid === selected.studentId)!.nameHistory!.map((h, i) => (
                                  <div key={i} className="flex justify-between space-x-4 opacity-70">
                                    <span>{h.name}</span>
                                    <span>{new Date(h.changedAt).toLocaleDateString()}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="text-[8px] text-stone-400">UID: {selected.studentId.substring(0, 8)}...</span>
                     </div>
                   </div>
                   <span className="text-stone-300">•</span>
                   <div className="flex items-center space-x-1">
                     <Clock size={12} />
                     <span>{new Date(selected.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                   </div>
                   <span className="text-stone-300">•</span>
                   <div className="flex items-center space-x-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                     <FileText size={10} />
                     <span className="text-[9px]">{selected.mode}</span>
                   </div>
                </div>
              </div>
              <div className="flex space-x-2">
                <button className="flex items-center justify-center p-3 border border-stone-200 rounded-xl hover:bg-white hover:shadow-md transition-all active:scale-95 text-stone-400" title="Archive">
                  <Download size={14} />
                </button>
                <button className="flex items-center space-x-2 px-5 py-3 bg-stone-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 shadow-xl shadow-stone-200 transition-all active:scale-95">
                  <GraduationCap size={14} />
                  <span>Certify Piece</span>
                </button>
              </div>
            </div>

            <div className="bg-indigo-600 rounded-[2.5rem] p-8 flex items-center justify-between shadow-2xl shadow-indigo-500/20 text-white border-b-8 border-indigo-800">
              <div className="flex items-center space-x-6">
                <div className="w-16 h-16 bg-white/10 rounded-[2rem] flex items-center justify-center text-white backdrop-blur-md border border-white/20">
                  <History size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-[0.2em] mb-1">Draft Evolution</h3>
                  <p className="text-indigo-100 text-[10px] font-black uppercase tracking-widest opacity-70">Witness the cognitive assembly of this manuscript</p>
                </div>
              </div>
              <button 
                onClick={() => setIsReplaying(true)}
                disabled={!selected.thinkingTrace || selected.thinkingTrace.length === 0}
                className="px-10 py-4 bg-white text-indigo-900 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-50 hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-30 disabled:grayscale"
              >
                Launch Replay
              </button>
            </div>

            <div className="grid grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-3xl border border-stone-200/60 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                   <ShieldCheck size={64} />
                </div>
                <div className="flex items-center space-x-2 mb-4 text-stone-400">
                   <ShieldCheck size={14} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Process Transparency</span>
                </div>
                <div className={`text-3xl font-black tracking-tighter ${selected.integrity.flagged ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {selected.integrity.flagged ? 'Review Signal' : 'High Transparency'}
                </div>
                <p className="text-[11px] text-stone-500 mt-4 leading-relaxed font-medium">
                  Observed {selected.integrity.pasteEvents} external insertions and {selected.integrity.burstAlerts} rapid velocity bursts.
                </p>
              </div>
              
              <div className="bg-white p-6 rounded-3xl border border-stone-200/60 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                   <Zap size={64} />
                </div>
                <div className="flex items-center space-x-2 mb-4 text-stone-400">
                   <Zap size={14} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Tempo Metric</span>
                </div>
                <div className="text-3xl font-black tracking-tighter text-stone-800">
                  {selected.integrity.averageWPM} <span className="text-sm font-bold text-stone-400 uppercase tracking-widest">WPM</span>
                </div>
                <p className="text-[11px] text-stone-500 mt-4 leading-relaxed font-medium">
                  Dynamic pace suggests organic composition sequence.
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-stone-200/60 shadow-sm relative overflow-hidden group bg-indigo-600 text-white border-none">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                   <Sparkles size={64} />
                </div>
                <div className="flex items-center space-x-2 mb-4 opacity-60">
                   <Sparkles size={14} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Arwright Insight</span>
                </div>
                <p className="text-[13px] leading-relaxed font-serif italic mb-4">
                  "{selected.tutorSummary || "Compiling depth analysis..."}"
                </p>
                <div className="flex items-center space-x-1.5 text-[9px] font-black bg-white/20 px-2 py-1 rounded-full w-fit">
                  <ExternalLink size={10} />
                  <span className="uppercase tracking-widest">Process Analysis Report</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-stone-200/60 shadow-sm space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <ShieldAlert size={20} className="text-stone-400" />
                  <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em]">Writing Process Integrity Review</h3>
                </div>
                {!selected.integrityReview && (
                  <button 
                    onClick={() => handleInitiateIntegrityReview(selected)}
                    disabled={isReviewing}
                    className="px-6 py-2 bg-stone-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center space-x-2 disabled:opacity-50"
                  >
                    {isReviewing ? <RotateCcw size={12} className="animate-spin" /> : <Zap size={12} />}
                    <span>Initiate Review</span>
                  </button>
                )}
              </div>

              {selected.integrityReview ? (
                <div className="space-y-8">
                  <div className="p-6 bg-stone-50 rounded-3xl border border-stone-100">
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2">Observations Summary</p>
                    <p className="text-stone-800 font-medium leading-relaxed">{selected.integrityReview.summary}</p>
                    <p className="text-[9px] text-stone-400 italic mt-4">
                      This review helps instructors understand how a piece of writing was created. It does not determine misconduct.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {selected.integrityReview.signals.map((signal, idx) => (
                      <div key={idx} className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black text-stone-400 uppercase tracking-widest">{signal.label}</span>
                          <div className={`w-2 h-2 rounded-full ${
                            signal.status === 'caution' ? 'bg-rose-400' : 
                            signal.status === 'positive' ? 'bg-emerald-400' : 'bg-stone-300'
                          }`}></div>
                        </div>
                        <p className="text-sm font-black text-stone-800">{signal.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 text-stone-400">
                         <Info size={14} />
                         <span className="text-[10px] font-black uppercase tracking-widest">Contextual Notes</span>
                      </div>
                      <p className="text-xs text-stone-500 leading-relaxed bg-stone-50 p-6 rounded-3xl border border-stone-100 italic">
                        {selected.integrityReview.contextualNotes}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 text-indigo-400">
                         <Sparkles size={14} />
                         <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Instructional Guidance</span>
                      </div>
                      <p className="text-xs text-indigo-700 leading-relaxed bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                        {selected.integrityReview.instructionalGuidance}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 bg-stone-50 rounded-[2rem] border border-dashed border-stone-200 text-center">
                  <Activity size={24} className="text-stone-200 mx-auto mb-4" />
                  <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] max-w-xs mx-auto leading-relaxed">
                    Review is teacher-initiated only. Initiate to analyze drafting timeline, paste events, and linguistic depth.
                  </p>
                </div>
              )}
            </div>

            {/* Submission Content */}
            <div className="flex flex-col items-center space-y-6">
              <div className="flex items-center space-x-3 self-start ml-2 text-stone-400">
                <FileText size={18} />
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em]">Manuscript Evidence</h3>
              </div>
              <div className="w-[816px] min-h-[1056px] bg-white p-[96px] rounded-sm shadow-xl border border-stone-100 flex flex-col relative shrink-0">
                 <div className="font-tnr text-xl leading-[1.8] text-stone-800 selection:bg-indigo-100">
                   {selected.document ? (
                     <div className="flex flex-col space-y-6">
                       {selected.document.paragraphs.map(p => {
                         const isTitle = p.kind === 'title' || p.kind === 'works-cited-title';
                         const isWorksCited = p.kind === 'works-cited-entry';
                         const isBody = p.kind === 'body';
                         
                         return (
                           <div 
                             key={p.id} 
                             className={`${isTitle ? 'text-center font-bold text-[1.2em] mb-4 mt-4' : ''} ${isWorksCited ? 'pl-[0.5in] -indent-[0.5in]' : ''} ${isBody ? 'text-indent-[0.5in]' : ''}`}
                             style={{ textIndent: isBody ? '0.5in' : undefined }}
                           >
                             {p.text}
                           </div>
                         );
                       })}
                     </div>
                   ) : (
                     <div className="whitespace-pre-wrap">{selected.content}</div>
                   )}
                 </div>
              </div>
            </div>

            {/* Writing Proficiency Analysis */}
            {selected.proficiencyMetrics ? (
              <div className="bg-white p-8 rounded-[2.5rem] border border-stone-200/60 shadow-sm space-y-6">
                <div className="flex items-center space-x-3 mb-2">
                  <GraduationCap size={20} className="text-indigo-500" />
                  <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em]">Reflective Analysis (Pro Synthesis)</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                    <span className="text-[9px] font-black text-stone-400 uppercase block mb-1">Proficiency Band</span>
                    <span className="text-lg font-black text-stone-800">{selected.proficiencyMetrics.approximateProficiencyBand}</span>
                  </div>
                  <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                    <span className="text-[9px] font-black text-stone-400 uppercase block mb-1">Readability</span>
                    <span className="text-lg font-black text-stone-800">{selected.proficiencyMetrics.readabilityScore}/100</span>
                  </div>
                  <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                    <span className="text-[9px] font-black text-stone-400 uppercase block mb-1">Vocabulary</span>
                    <span className="text-lg font-black text-stone-800">{selected.proficiencyMetrics.vocabularyComplexity}</span>
                  </div>
                  <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                    <span className="text-[9px] font-black text-stone-400 uppercase block mb-1">Structure</span>
                    <span className="text-lg font-black text-stone-800">{selected.proficiencyMetrics.structuralMaturity}</span>
                  </div>
                </div>
                <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                  <span className="text-[9px] font-black text-indigo-400 uppercase block mb-2">Internal Professional Synthesis</span>
                  <p className="text-sm text-stone-700 leading-relaxed italic">"{selected.proficiencyMetrics.feedbackSummary}"</p>
                </div>
              </div>
            ) : (
              <div className="bg-white p-12 rounded-[2.5rem] border border-stone-200/60 shadow-sm text-center">
                <Sparkles size={24} className="mx-auto mb-3 text-stone-300" />
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Synthesis will be generated upon next professional analysis.</p>
              </div>
            )}

            {/* Class Comparison Chart */}
            <div className="bg-white p-8 rounded-3xl border border-stone-200/60 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                  <BarChart3 size={18} className="text-indigo-400" />
                  <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em]">Class Benchmarking</h3>
                </div>
                <select className="text-[10px] font-black uppercase tracking-widest text-stone-500 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-100 outline-none">
                   <option>Velocity (WPM)</option>
                   <option>Process Transparency</option>
                </select>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statsData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      fontSize={9} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontWeight: 600}} 
                    />
                    <YAxis 
                      fontSize={9} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#94a3b8', fontWeight: 600}} 
                    />
                    <Tooltip 
                      cursor={{fill: '#f1f5f9'}}
                      contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px'}}
                      labelStyle={{fontWeight: 900, textTransform: 'uppercase', fontSize: '10px', color: '#64748b', marginBottom: '4px'}}
                    />
                    <Bar dataKey="wpm" radius={[8, 8, 0, 0]} barSize={40}>
                      {statsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.transparency < 50 ? '#f43f5e' : '#6366f1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-stone-400 px-12 text-center py-20">
            <div className="w-24 h-24 bg-white rounded-3xl shadow-sm border border-stone-100 flex items-center justify-center mb-6">
              <Search size={40} className="text-stone-200" />
            </div>
            <p className="font-black uppercase tracking-widest text-xs text-stone-400">Select a student profile to begin</p>
            <p className="text-[11px] text-stone-400 mt-2 max-w-xs leading-relaxed">
              Arwright is standing by to cross-reference compositional evidence and linguistic depth.
            </p>
          </div>
        )}
      </div>
    </>
  ) : (
        <div className="flex-1 overflow-y-auto p-12 bg-stone-50">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className="flex justify-between items-end">
              <div>
                <h1 className="text-4xl font-black text-stone-900 tracking-tighter">Your Classrooms</h1>
                <p className="text-sm font-bold text-stone-400 uppercase tracking-widest mt-2 ml-1">Academic Cycle 2024-2025</p>
              </div>
              <button 
                onClick={() => setIsAddingClass(true)}
                className="flex items-center space-x-3 px-8 py-4 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all"
              >
                <Plus size={20} />
                <span>Create Class</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {classes.map(classroom => (
                <div key={classroom.id} className="bg-white p-8 rounded-[3rem] border border-stone-200 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
                  <div className="flex items-start justify-between mb-8">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-xl font-black text-stone-900">{classroom.name}</h3>
                        {classroom.expiresAt && new Date(classroom.expiresAt) < new Date() && (
                          <span className="bg-stone-100 text-stone-400 text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Legacy</span>
                        )}
                      </div>
                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                          {classroom.gradeLevel || 'No Grade Specified'}
                          {classroom.period && ` • ${classroom.period}`}
                        </p>
                    </div>
                    <button 
                      onClick={() => handleDeleteClass(classroom.id)}
                      className="p-2 opacity-0 group-hover:opacity-100 hover:bg-rose-50 text-rose-500 rounded-xl transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="bg-stone-50 rounded-2xl p-6 mb-8 flex items-center justify-between border border-stone-100">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-1">Enrollment Code</p>
                      <p className="text-2xl font-black text-indigo-600 tracking-[0.2em]">{classroom.classCode}</p>
                    </div>
                    <button 
                      onClick={() => copyClassCode(classroom.classCode, classroom.id)}
                      className="p-3 bg-white border border-stone-200 rounded-xl hover:shadow-md transition-all text-stone-400 hover:text-indigo-600"
                    >
                      {copiedClassId === classroom.id ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Copy size={18} />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-stone-100">
                    <button 
                      onClick={() => setIsManagingRosterId(classroom.id)}
                      className="flex items-center space-x-2 group/roster"
                    >
                       <Users size={14} className="text-stone-400 group-hover/roster:text-indigo-500 transition-colors" />
                       <span className="text-xs font-bold text-stone-700 group-hover/roster:text-indigo-600 transition-colors">{classroom.studentCount} Students</span>
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedClassId(classroom.id);
                        setActiveTab('submissions');
                      }}
                      className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center space-x-1"
                    >
                      <span>View Registry</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              ))}

              <button 
                onClick={() => setIsAddingClass(true)}
                className="border-4 border-dashed border-stone-200 rounded-[3rem] p-12 flex flex-col items-center justify-center text-stone-300 hover:border-indigo-200 hover:text-indigo-400 hover:bg-indigo-50/50 transition-all space-y-4"
              >
                <div className="w-16 h-16 border-2 border-current rounded-[2rem] flex items-center justify-center">
                  <Plus size={32} />
                </div>
                <span className="font-black uppercase tracking-widest text-sm">Provision New Class</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Class Modal */}
      <AnimatePresence>
        {isAddingClass && (
          <div className="fixed inset-0 z-[70] bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="px-10 py-8 border-b flex items-center justify-between bg-stone-50">
                <div>
                  <h2 className="text-2xl font-black text-stone-900 tracking-tight">Create Classroom</h2>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Assign parameters for new enrollment group</p>
                </div>
                <button onClick={() => setIsAddingClass(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                  <X size={20} className="text-stone-400" />
                </button>
              </div>

              <form onSubmit={handleAddClass} className="p-10 space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2 ml-1">Nomenclature / Class Name</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. Bio 101 - Section A"
                    className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-medium"
                    value={newClass.name}
                    onChange={e => setNewClass({...newClass, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2 ml-1">Grade Level (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 10th Grade"
                    className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-medium"
                    value={newClass.gradeLevel}
                    onChange={e => setNewClass({...newClass, gradeLevel: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2 ml-1">Class Period (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 1st Period or Session A"
                    className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-medium"
                    value={newClass.period}
                    onChange={e => setNewClass({...newClass, period: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2 ml-1">Class Duration (Days)</label>
                  <select 
                    className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-medium"
                    value={newClass.expirationDays}
                    onChange={e => setNewClass({...newClass, expirationDays: e.target.value})}
                  >
                    <option value="90">90 Days (Quarter)</option>
                    <option value="180">180 Days (Semester)</option>
                    <option value="365">365 Days (Full Year)</option>
                    <option value="730">2 Years</option>
                  </select>
                </div>
                <div className="pt-4 flex flex-col space-y-4">
                  <button 
                    type="submit"
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
                  >
                    Establish Classroom
                  </button>
                  <p className="text-[9px] text-stone-400 text-center font-medium italic">
                    By creating this class, you will generate a unique enrollment code for students.
                  </p>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isReplaying && selected && selected.thinkingTrace && (
          <DraftEvolutionReplay 
            trace={selected.thinkingTrace} 
            studentName={selected.studentName} 
            onClose={() => setIsReplaying(false)} 
          />
        )}
      </AnimatePresence>

      {/* Assign Class Photo Modal */}
      <AnimatePresence>
        {isAssigningPhoto && (
          <div className="fixed inset-0 z-[1000] bg-stone-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                    <Camera size={24} />
                  </div>
                  <div>
                    <h3 className="font-black text-stone-900 text-lg">Class Identity Photo</h3>
                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Assign student image for this class</p>
                  </div>
                </div>
                <button onClick={() => setIsAssigningPhoto(null)} className="text-stone-400 hover:text-stone-600">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100">
                  <p className="text-[11px] text-stone-500 leading-relaxed mb-4">
                    Enter an image URL to override the student's avatar within <b>this class context</b>. This facilitates faster recognition during review.
                  </p>
                  <input 
                    type="url" 
                    placeholder="https://..."
                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm font-medium"
                    value={photoUrlInput}
                    onChange={e => setPhotoUrlInput(e.target.value)}
                  />
                  <p className="text-[9px] text-stone-400 font-bold uppercase mt-2">Visible to you only in this classroom scope</p>
                </div>

                <div className="flex space-x-4">
                  <button 
                    onClick={() => {
                      setPhotoUrlInput('');
                      handleAssignPhoto();
                    }}
                    className="flex-1 py-4 bg-stone-100 text-stone-500 rounded-2xl font-black uppercase tracking-widest hover:bg-stone-200 transition-all"
                  >
                    Reset
                  </button>
                  <button 
                    onClick={handleAssignPhoto}
                    className="flex-[2] py-4 bg-stone-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-stone-800 transition-all"
                  >
                    Assign Photo
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Manage Roster Modal */}
      <AnimatePresence>
        {isManagingRosterId && (
          <div className="fixed inset-0 z-[1100] bg-stone-900/40 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-10 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-stone-900 leading-tight">Classroom Roster</h3>
                  <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">
                    Managing {classes.find(c => c.id === isManagingRosterId)?.name}
                  </p>
                </div>
                <button 
                  onClick={() => setIsManagingRosterId(null)}
                  className="p-3 bg-stone-50 hover:bg-stone-100 rounded-2xl text-stone-400 hover:text-stone-600 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-4 no-scrollbar">
                {classStudents.length === 0 ? (
                  <div className="text-center py-20">
                    <Users size={48} className="text-stone-100 mx-auto mb-4" />
                    <p className="text-stone-400 font-bold text-sm tracking-tight">No scholars currently enrolled.</p>
                  </div>
                ) : (
                  classStudents.map(student => (
                    <div key={student.uid} className="flex items-center justify-between p-6 bg-stone-50 rounded-3xl border border-stone-100">
                      <div className="flex items-center space-x-4">
                        <img 
                          src={studentPhotos[student.uid] || student.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.uid}`} 
                          className="w-12 h-12 rounded-2xl shadow-sm" 
                          alt="" 
                        />
                        <div>
                          <p className="font-black text-stone-800">{student.firstName} {student.lastName}</p>
                          <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">{student.email}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveStudentFromClass(student.uid, isManagingRosterId)}
                        className="p-3 text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
                        title="Remove Student"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>
              
              <div className="p-10 bg-stone-50 border-t border-stone-100">
                <p className="text-[10px] text-stone-400 font-bold uppercase text-center leading-relaxed">
                  Removing a student from a class preserves their work history but detaches them from your institutional registry for this context.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeacherMode;
