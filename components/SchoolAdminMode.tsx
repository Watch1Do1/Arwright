import React, { useState, useEffect } from 'react';
import { 
  Users, 
  School as SchoolIcon, 
  Search, 
  Filter,
  ArrowRightLeft,
  Key,
  Copy,
  CheckCircle2,
  AlertCircle,
  DoorOpen,
  GraduationCap,
  Plus,
  Trash2,
  X,
  RotateCcw,
  History
} from 'lucide-react';
import { UserProfile, School, UserRole, Classroom, Cohort, UserStatus } from '../types';
import { db } from '../services/firebase';
import { collection, onSnapshot, query, where, doc, updateDoc, getDoc, addDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

interface SchoolAdminModeProps {
  userProfile: UserProfile;
}

const SchoolAdminMode: React.FC<SchoolAdminModeProps> = ({ userProfile }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedCodeId, setCopiedCodeId] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'users' | 'classes' | 'cohorts'>('users');
  
  // Cohort Creation State
  const [isAddingCohort, setIsAddingCohort] = useState(false);
  const [newCohort, setNewCohort] = useState({ name: '', graduationDate: '' });

  const generateCode = (length: number = 6) => {
    return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
  };

  useEffect(() => {
    if (!userProfile.schoolId) return;

    setLoading(true);
    
    // Fetch School Data
    const unsubscribeSchool = onSnapshot(doc(db, 'schools', userProfile.schoolId), (doc) => {
      if (doc.exists()) {
        setSchool({ id: doc.id, ...doc.data() } as School);
      }
    });

    // Fetch School Users
    const usersQuery = query(
      collection(db, 'users'), 
      where('schoolId', '==', userProfile.schoolId)
    );
    
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const userData = snapshot.docs.map(d => ({ ...d.data() } as UserProfile));
      setUsers(userData);
    });

    // Fetch School Classes
    const classesQuery = query(
      collection(db, 'classes'),
      where('schoolId', '==', userProfile.schoolId)
    );

    const unsubscribeClasses = onSnapshot(classesQuery, (snapshot) => {
      const classData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Classroom));
      setClasses(classData);
      setLoading(false);
    });

    return () => {
      unsubscribeSchool();
      unsubscribeUsers();
      unsubscribeClasses();
    };
  }, [userProfile.schoolId]);

  useEffect(() => {
    if (!userProfile.schoolId) return;
    const cohortsQuery = query(
      collection(db, 'cohorts'),
      where('schoolId', '==', userProfile.schoolId)
    );
    const unsubscribeCohorts = onSnapshot(cohortsQuery, (snapshot) => {
      setCohorts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Cohort)));
    });
    return unsubscribeCohorts;
  }, [userProfile.schoolId]);

  const handleToggleAccount = async (userId: string, status: UserStatus) => {
    try {
      await updateDoc(doc(db, 'users', userId), { status });
    } catch (err) {
      console.error("Error toggling account:", err);
    }
  };

  const handleAddCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCohort.name || !newCohort.graduationDate) return;
    try {
      let uniqueCode = '';
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 5) {
        uniqueCode = generateCode();
        const q = query(
          collection(db, 'cohorts'),
          where('schoolId', '==', userProfile.schoolId),
          where('cohortCode', '==', uniqueCode)
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        alert("Collision detected. Please try again.");
        return;
      }

      await addDoc(collection(db, 'cohorts'), {
        ...newCohort,
        schoolId: userProfile.schoolId,
        cohortCode: uniqueCode,
        graduationDate: new Date(newCohort.graduationDate).getTime(),
        createdAt: Date.now()
      });
      setIsAddingCohort(false);
      setNewCohort({ name: '', graduationDate: '' });
    } catch (err) {
      console.error("Error adding cohort:", err);
    }
  };

  const handleRotateCohortCode = async (cohortId: string) => {
    const confirmed = window.confirm("Rotate this cohort's enrollment code? New students will require the new code, but existing students are unaffected.");
    if (!confirmed) return;
    try {
      let uniqueCode = '';
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 5) {
        uniqueCode = generateCode();
        const q = query(
          collection(db, 'cohorts'),
          where('schoolId', '==', userProfile.schoolId),
          where('cohortCode', '==', uniqueCode)
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        alert("Collision detected. Please try again.");
        return;
      }

      await updateDoc(doc(db, 'cohorts', cohortId), {
        cohortCode: uniqueCode
      });
    } catch (err) {
      console.error("Error rotating cohort code:", err);
    }
  };

  const handleAssignCohort = async (userId: string, cohortId: string) => {
    const cohort = cohorts.find(c => c.id === cohortId);
    if (!cohort) return;
    try {
      await updateDoc(doc(db, 'users', userId), { 
        cohortId, 
        graduationDate: cohort.graduationDate 
      });
    } catch (err) {
      console.error("Error assigning cohort:", err);
    }
  };

  const handleReassignSchool = async (userId: string) => {
    const confirmed = window.confirm("Are you sure you want to remove this user from your institution? They will enter 'Detached' status, preserving their writing history but pausing AI access.");
    if (!confirmed) return;
    try {
      await updateDoc(doc(db, 'users', userId), { 
        schoolId: null,
        cohortId: null,
        classIds: [],
        status: UserStatus.DETACHED_STUDENT 
      });
    } catch (err) {
      console.error("Error removing user from school:", err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(true);
    setTimeout(() => setCopiedCodeId(false), 2000);
  };

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-stone-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-stone-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b px-8 py-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <SchoolIcon size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-stone-900 leading-tight">Institution Console</h1>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em]">{school?.name || 'Loading Campus...'}</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center space-x-2 bg-stone-50 border border-stone-200 px-3 py-2 rounded-xl">
             <Key size={14} className="text-indigo-500" />
             <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Enrollment Code:</span>
             <span className="text-sm font-black text-stone-900 tracking-wider uppercase">{school?.schoolCode}</span>
             <button 
               onClick={() => copyToClipboard(school?.schoolCode || '')}
               className="p-1.5 hover:bg-white rounded-lg transition-all text-stone-400 hover:text-indigo-600"
             >
               {copiedCodeId ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
             </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-[2rem] border border-stone-200 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Total Faculty</p>
              <p className="text-3xl font-black text-stone-900">{users.filter(u => u.role === UserRole.TEACHER).length}</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-stone-200 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Total Students</p>
              <p className="text-3xl font-black text-stone-900">{users.filter(u => u.role === UserRole.STUDENT).length}</p>
            </div>
            <div className="bg-indigo-600 p-6 rounded-[2rem] shadow-xl shadow-indigo-100 text-white">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Campus Status</p>
              <p className="text-3xl font-black">{school?.status}</p>
            </div>
          </div>

          {/* Security Banner */}
          <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start space-x-3">
            <AlertCircle className="text-amber-600 mt-0.5" size={18} />
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-amber-900">Security Restriction</p>
               <p className="text-[11px] text-amber-700 font-medium">For security reasons, enrollment codes can only be regenerated by Arwright Support. Personal and submission data is restricted to identified faculty.</p>
            </div>
          </div>

          {/* User & Class Management */}
          <div className="bg-white rounded-[3rem] border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b flex items-center justify-between bg-stone-50/50">
              <div className="flex items-center space-x-8">
                <button 
                  onClick={() => setActiveTab('users')}
                  className={`flex items-center space-x-3 transition-colors ${activeTab === 'users' ? 'text-indigo-600' : 'text-stone-400 hover:text-stone-600'}`}
                >
                  <Users size={20} />
                  <h2 className="text-sm font-black uppercase tracking-widest">User Management</h2>
                </button>
                <button 
                  onClick={() => setActiveTab('classes')}
                  className={`flex items-center space-x-3 transition-colors ${activeTab === 'classes' ? 'text-indigo-600' : 'text-stone-400 hover:text-stone-600'}`}
                >
                  <DoorOpen size={20} />
                  <h2 className="text-sm font-black uppercase tracking-widest">Classrooms</h2>
                </button>
                <button 
                  onClick={() => setActiveTab('cohorts')}
                  className={`flex items-center space-x-3 transition-colors ${activeTab === 'cohorts' ? 'text-indigo-600' : 'text-stone-400 hover:text-stone-600'}`}
                >
                  <GraduationCap size={20} />
                  <h2 className="text-sm font-black uppercase tracking-widest">Cohorts</h2>
                </button>
              </div>
              <div className="flex items-center space-x-4">
                {activeTab === 'cohorts' && (
                  <button 
                    onClick={() => setIsAddingCohort(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Cohort</span>
                  </button>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                  <input 
                    type="text" 
                    placeholder={activeTab === 'users' ? "Filter users..." : "Filter classes..."}
                    className="pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              {activeTab === 'users' ? (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b bg-stone-50/50">
                      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Identity</th>
                      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Role</th>
                      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Status</th>
                      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredUsers.map(user => (
                      <tr key={user.uid} className={`group hover:bg-stone-50/50 transition-colors ${user.status === UserStatus.ARCHIVED ? 'opacity-50' : ''}`}>
                        <td className="px-8 py-4">
                          <div className="flex items-center space-x-3">
                            <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} className="w-10 h-10 rounded-xl" alt="" />
                            <div>
                              <p className="text-sm font-black text-stone-900">{user.displayName}</p>
                              <div className="flex items-center space-x-2">
                                <p className="text-[10px] font-medium text-stone-400">{user.email}</p>
                                {user.cohortId && (
                                  <span className="text-[8px] bg-stone-100 px-1.5 py-0.5 rounded-full text-stone-500 font-black uppercase">
                                    {cohorts.find(c => c.id === user.cohortId)?.name}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-4">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            user.role === UserRole.TEACHER ? 'bg-indigo-100 text-indigo-600' : 
                            user.role === UserRole.STUDENT ? 'bg-emerald-100 text-emerald-600' :
                            'bg-stone-200 text-stone-600'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-8 py-4">
                          {user.status === UserStatus.ARCHIVED ? (
                            <span className="flex items-center text-rose-500 text-[10px] font-black uppercase tracking-widest">
                              <span className="w-1.5 h-1.5 rounded-full bg-current mr-2 animate-pulse" />
                              Archived
                            </span>
                          ) : user.status === UserStatus.DETACHED_STUDENT ? (
                            <span className="flex items-center text-amber-500 text-[10px] font-black uppercase tracking-widest">
                              <span className="w-1.5 h-1.5 rounded-full bg-current mr-2" />
                              Detached
                            </span>
                          ) : (
                            <span className="flex items-center text-emerald-500 text-[10px] font-black uppercase tracking-widest">
                              <span className="w-1.5 h-1.5 rounded-full bg-current mr-2" />
                              {user.status}
                            </span>
                          )}
                        </td>
                        <td className="px-8 py-4 text-right">
                          <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <select 
                                  className="text-[9px] font-black uppercase tracking-widest bg-stone-50 border border-stone-200 px-2 py-1 rounded-lg"
                                  value={user.cohortId || ''}
                                  onChange={(e) => handleAssignCohort(user.uid, e.target.value)}
                                >
                                  <option value="">Move to Cohort</option>
                                  {cohorts.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </select>
                                <button 
                                  onClick={() => handleReassignSchool(user.uid)}
                                  className="p-2 hover:bg-amber-50 text-amber-600 rounded-xl transition-colors"
                                  title="Remove from Institution"
                                >
                                  <ArrowRightLeft size={16} />
                                </button>
                                <button 
                                  onClick={() => handleToggleAccount(user.uid, user.status === UserStatus.ARCHIVED ? UserStatus.ACTIVE_STUDENT : UserStatus.ARCHIVED)}
                                  className="p-2 hover:bg-stone-100 text-stone-600 rounded-xl transition-colors"
                                  title={user.status === UserStatus.ARCHIVED ? 'Restore Account' : 'Archive Account'}
                                >
                                  <Users size={16} />
                                </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : activeTab === 'classes' ? (
                <table className="w-full text-left">
                   <thead>
                    <tr className="border-b bg-stone-50/50">
                      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Classroom Name</th>
                      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Instructor</th>
                      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Enrollment</th>
                      <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400 text-right">Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {classes.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).map(classroom => (
                      <tr key={classroom.id} className="hover:bg-stone-50/50 transition-colors">
                        <td className="px-8 py-5">
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-black text-stone-900">{classroom.name}</p>
                              {classroom.expiresAt && new Date(classroom.expiresAt) < new Date() && (
                                <span className="bg-stone-100 text-stone-400 text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Expired</span>
                              )}
                            </div>
                            <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">{classroom.gradeLevel || 'Secondary'}</p>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center space-x-2 text-stone-700 font-bold text-sm">
                            <GraduationCap size={16} className="text-indigo-400" />
                            <span>{classroom.teacherName}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center space-x-2">
                            <Users size={14} className="text-stone-300" />
                            <span className="text-xs font-black text-stone-700">{classroom.studentCount} Students</span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span className="font-black text-xs text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg tracking-widest uppercase">
                            {classroom.classCode}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left">
                  <thead>
                   <tr className="border-b bg-stone-50/50">
                     <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Cohort Name</th>
                     <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Graduation Date</th>
                     <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Enrollment Code</th>
                     <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400 text-right">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-stone-100">
                   {cohorts.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).map(cohort => (
                     <tr key={cohort.id} className="hover:bg-stone-50/50 transition-colors">
                       <td className="px-8 py-5">
                         <p className="text-sm font-black text-stone-900">{cohort.name}</p>
                       </td>
                       <td className="px-8 py-5 text-sm font-bold text-stone-700">
                         {new Date(cohort.graduationDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                       </td>
                       <td className="px-8 py-5">
                          <div className="flex items-center space-x-2">
                             <span className="font-black text-xs text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg tracking-widest uppercase">{cohort.cohortCode}</span>
                             <button 
                               onClick={() => handleRotateCohortCode(cohort.id)}
                               className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-indigo-600 transition-colors"
                               title="Rotate Code"
                             >
                               <RotateCcw size={14} />
                             </button>
                          </div>
                       </td>
                       <td className="px-8 py-5 text-right">
                         <button 
                           onClick={async () => {
                             if(window.confirm("Delete cohort? This won't remove graduates but will stop new assignments.")) {
                               await deleteDoc(doc(db, 'cohorts', cohort.id));
                             }
                           }}
                           className="p-2 hover:bg-rose-50 text-rose-500 rounded-xl transition-colors"
                         >
                           <Trash2 size={16} />
                         </button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
              )}
              {filteredUsers.length === 0 && (
                <div className="p-20 text-center">
                  <div className="w-16 h-16 bg-stone-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-stone-300">
                    <Search size={32} />
                  </div>
                  <p className="text-sm font-bold text-stone-400 uppercase tracking-widest">No users found matching filters</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Cohort Modal */}
      <AnimatePresence>
        {isAddingCohort && (
          <div className="fixed inset-0 z-[100] bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b flex items-center justify-between">
                <h2 className="text-xl font-black text-stone-900 tracking-tight">Provision Graduation Class</h2>
                <button onClick={() => setIsAddingCohort(false)} className="text-stone-400 hover:text-stone-600">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddCohort} className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Cohort Nomenclature</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. Class of 2029"
                    className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-medium"
                    value={newCohort.name}
                    onChange={e => setNewCohort({...newCohort, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Target Graduation Date</label>
                  <input 
                    required
                    type="date" 
                    className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all font-medium"
                    value={newCohort.graduationDate}
                    onChange={e => setNewCohort({...newCohort, graduationDate: e.target.value})}
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all"
                >
                  Confirm Cohort
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SchoolAdminMode;
