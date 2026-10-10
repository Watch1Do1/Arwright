
import React, { useState, useEffect } from 'react';
import { db, auth } from '../services/firebase';
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc,
  orderBy, 
  limit,
  onSnapshot 
} from 'firebase/firestore';
import { 
  Users, 
  School as SchoolIcon, 
  BarChart3, 
  Settings as SettingIcon,
  ShieldAlert,
  Search,
  ArrowRightLeft,
  GraduationCap,
  Briefcase,
  AlertCircle,
  FileText,
  Activity,
  Cpu,
  Plus,
  X,
  RefreshCw,
  Key,
  Copy,
  CheckCircle2
} from 'lucide-react';
import { UserProfile, School, UserRole, AiUsageLog } from '../types';
import { motion, AnimatePresence } from 'motion/react';

const AdminMode: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'schools' | 'analytics' | 'logs'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [logs, setLogs] = useState<AiUsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingSchool, setIsAddingSchool] = useState(false);
  const [newSchool, setNewSchool] = useState<Partial<School>>({
    schoolType: 'Public',
    country: 'USA',
    status: 'Prospect'
  });
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [isInvitingAdmin, setIsInvitingAdmin] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSchoolId, setInviteSchoolId] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);

  useEffect(() => {
    setLoading(true);
    // Real-time users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const userData = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id }) as UserProfile);
      setUsers(userData);
    });

    // Real-time schools
    const unsubSchools = onSnapshot(collection(db, 'schools'), (snapshot) => {
      const schoolData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as School);
      setSchools(schoolData);
    });

    // Real-time logs (last 50)
    const qLogs = query(collection(db, 'ai_logs'), orderBy('timestamp', 'desc'), limit(50));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const logData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as AiUsageLog);
      setLogs(logData);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubSchools();
      unsubLogs();
    };
  }, []);

  const generateCode = (name: string) => {
    const prefix = (name || 'SCH').slice(0, 3).toUpperCase();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${random}`;
  };

  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    try {
      // Roles can only be changed by the server
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/set-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ uid: userId, role: newRole })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        alert(data.error || "Failed to update role");
      }
    } catch (err) {
      console.error("Error updating role:", err);
      alert("Failed to update role");
    }
  };

  const handleReassignSchool = async (userId: string) => {
    if (schools.length === 0) {
      alert("No schools defined yet. Add a school first.");
      return;
    }
    const schoolList = schools.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
    const choice = prompt(`Select school number:\n${schoolList}\n\nEnter number (1-${schools.length}):`);
    if (!choice) return;
    const index = parseInt(choice) - 1;
    if (index >= 0 && index < schools.length) {
      try {
        await updateDoc(doc(db, 'users', userId), { schoolId: schools[index].id });
      } catch (err) {
        console.error("Error reassigning school:", err);
      }
    } else {
      alert("Invalid selection.");
    }
  };

  const handleToggleAccount = async (userId: string, disabled: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), { disabled });
    } catch (err) {
      console.error("Error toggling account:", err);
    }
  };

  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchool.name) return;
    
    try {
      const code = generateCode(newSchool.name);
      await addDoc(collection(db, 'schools'), {
        ...newSchool,
        schoolCode: code,
        submissionCount: 0,
        userCount: 0
      });
      setIsAddingSchool(false);
      setNewSchool({ schoolType: 'Public', country: 'USA' });
    } catch (err) {
      console.error("Error adding school:", err);
    }
  };

  const regenerateSchoolCode = async (schoolId: string, name: string) => {
    const confirmed = window.confirm("This will invalidate the previous code. Any teachers currently onboarding with the old code will be blocked until provided the new one. Proceed?");
    if (!confirmed) return;
    
    const newCode = generateCode(name);
    try {
      await updateDoc(doc(db, 'schools', schoolId), { schoolCode: newCode });
    } catch (err) {
      console.error("Error updating school code:", err);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handleInviteAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingInvite(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/create-school-admin-invite', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ schoolId: inviteSchoolId, email: inviteEmail })
      });
      const data = await response.json();
      if (data.inviteLink) {
        setInviteLink(data.inviteLink);
      } else {
        alert(data.error || "Failed to create invite");
      }
    } catch (err) {
      console.error(err);
      alert("Error creating invite");
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateTotalTokens = () => logs.reduce((acc, log) => acc + log.totalTokens, 0);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-stone-50 overflow-hidden">
      {/* Modals */}
      <AnimatePresence>
        {isInvitingAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
               <div className="px-8 py-6 bg-stone-50 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-stone-900">Authorize School Admin</h2>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Formal Invitation Sequence</p>
                </div>
                <button onClick={() => setIsInvitingAdmin(false)} className="p-2 hover:bg-white rounded-xl transition-colors">
                  <X size={20} className="text-stone-400" />
                </button>
              </div>

              <div className="p-8">
                {!inviteLink ? (
                  <form onSubmit={handleInviteAdmin} className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5 ml-1">Administrator Email</label>
                      <input 
                        required
                        type="email" 
                        placeholder="principal@institution.edu"
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={isCreatingInvite}
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                      {isCreatingInvite ? "Generating Token..." : "Generate Secure Invite"}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-6">
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center space-x-3">
                      <CheckCircle2 className="text-emerald-500" size={24} />
                      <p className="text-sm font-bold text-emerald-900 font-mono break-all selection:bg-emerald-200">{inviteLink}</p>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(inviteLink, 'invite-link')}
                      className="w-full py-4 bg-stone-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center space-x-2"
                    >
                      {copiedCodeId === 'invite-link' ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                      <span>{copiedCodeId === 'invite-link' ? "Copied" : "Copy Secure Link"}</span>
                    </button>
                    <p className="text-[9px] text-stone-400 text-center uppercase font-bold tracking-widest">
                      Send this link to the school official. It will expire in 7 days.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
        {isAddingSchool && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 bg-stone-50 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-stone-900">Add New Institution</h2>
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">MVP Onboarding Process</p>
                </div>
                <button onClick={() => setIsAddingSchool(false)} className="p-2 hover:bg-white rounded-xl transition-colors">
                  <X size={20} className="text-stone-400" />
                </button>
              </div>

              <form onSubmit={handleAddSchool} className="p-8 grid grid-cols-2 gap-x-6 gap-y-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5 ml-1">Campus Name</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. Oakridge High School"
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium"
                    value={newSchool.name || ''}
                    onChange={e => setNewSchool({...newSchool, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5 ml-1">City</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium"
                    value={newSchool.city || ''}
                    onChange={e => setNewSchool({...newSchool, city: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5 ml-1">State / Province</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium"
                    value={newSchool.state || ''}
                    onChange={e => setNewSchool({...newSchool, state: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5 ml-1">Primary Contact Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium"
                    value={newSchool.contactName || ''}
                    onChange={e => setNewSchool({...newSchool, contactName: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5 ml-1">Primary Contact Email</label>
                  <input 
                    required
                    type="email" 
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium"
                    value={newSchool.contactEmail || ''}
                    onChange={e => setNewSchool({...newSchool, contactEmail: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5 ml-1">School Type</label>
                  <select 
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium appearance-none"
                    value={newSchool.schoolType}
                    onChange={e => setNewSchool({...newSchool, schoolType: e.target.value})}
                  >
                    <option>Public</option>
                    <option>Private</option>
                    <option>Charter</option>
                    <option>International</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5 ml-1">Enrollment (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 500-1000"
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium"
                    value={newSchool.enrollmentSize || ''}
                    onChange={e => setNewSchool({...newSchool, enrollmentSize: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1.5 ml-1">Internal Status</label>
                  <select 
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium appearance-none"
                    value={newSchool.status}
                    onChange={e => setNewSchool({...newSchool, status: e.target.value as any})}
                  >
                    <option value="Prospect">Prospect</option>
                    <option value="Pilot">Pilot</option>
                    <option value="Active">Active</option>
                    <option value="Paused">Paused</option>
                  </select>
                </div>

                <div className="col-span-2 mt-4 pt-6 border-t flex justify-end space-x-3">
                  <button 
                    type="button"
                    onClick={() => setIsAddingSchool(false)}
                    className="px-6 py-3 rounded-2xl text-stone-500 font-black uppercase text-xs tracking-widest hover:bg-stone-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all"
                  >
                    Register School
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Admin Header */}
      <div className="bg-white border-b px-8 py-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-red-200">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider text-stone-900">Command Center</h1>
            <p className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">Pilot Admin Panel v1.0</p>
          </div>
        </div>

        <div className="flex bg-stone-100 p-1 rounded-xl">
          {[
            { id: 'users', label: 'Users', icon: Users },
            { id: 'schools', label: 'Schools', icon: SchoolIcon },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'logs', label: 'AI Logs', icon: Cpu }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === tab.id 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-stone-400 hover:text-stone-600'
              }`}
            >
              <tab.icon size={14} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'users' && (
            <motion.div 
              key="users"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="relative w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search users by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                  />
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Total Users: {users.length}</span>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">User</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Role</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">School</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredUsers.map(user => (
                      <tr key={user.uid} className="hover:bg-stone-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-stone-100 overflow-hidden border-2 border-white shadow-sm shrink-0">
                                <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-stone-900">{user.displayName}</p>
                                <p className="text-[10px] text-stone-400 font-bold">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                           <select 
                             value={user.role}
                             onChange={(e) => handleUpdateRole(user.uid, e.target.value as UserRole)}
                             className="bg-stone-50 border-none text-[10px] font-black uppercase tracking-widest text-stone-600 focus:ring-0 cursor-pointer rounded-lg hover:bg-stone-100 transition-colors"
                           >
                             <option value={UserRole.STUDENT}>Student</option>
                             <option value={UserRole.TEACHER}>Teacher</option>
                             <option value={UserRole.SCHOOL_ADMIN}>School Admin</option>
                             <option value={UserRole.ADMIN}>Admin</option>
                           </select>
                        </td>
                        <td className="px-6 py-4">
                           <p className="text-xs font-bold text-stone-600">{schools.find(s => s.id === user.schoolId)?.name || 'Unassigned'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`flex items-center space-x-1 ${user.disabled ? 'text-red-500' : 'text-emerald-500'}`}>
                             <div className={`w-2 h-2 rounded-full ${user.disabled ? 'bg-red-500' : 'bg-emerald-500'}`} />
                             <span className="text-[10px] font-black uppercase tracking-widest">{user.disabled ? 'Disabled' : 'Active'}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                             <button 
                               onClick={() => handleReassignSchool(user.uid)}
                               className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-xl transition-colors"
                               title="Reassign School"
                             >
                               <SchoolIcon size={16} />
                             </button>
                             <button 
                               onClick={() => handleToggleAccount(user.uid, !user.disabled)}
                               className="p-2 hover:bg-stone-100 text-stone-600 rounded-xl transition-colors"
                               title={user.disabled ? 'Enable Account' : 'Disable Account'}
                             >
                               {user.disabled ? <Activity size={16} /> : <AlertCircle size={16} />}
                             </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div 
               key="analytics"
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {[
                { label: 'Total AI Interactions', value: logs.length, icon: Cpu, color: 'indigo' },
                { label: 'Token Consumption', value: calculateTotalTokens().toLocaleString(), icon: Activity, color: 'emerald' },
                { label: 'Active Sessions', value: '12', icon: Activity, color: 'blue' },
                { label: 'System Health', value: '100%', icon: ShieldAlert, color: 'rose' }
              ].map((stat, i) => (
                <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-stone-200 shadow-sm relative overflow-hidden group hover:shadow-xl hover:shadow-stone-200/50 transition-all">
                  <div className={`absolute top-0 right-0 w-24 h-24 bg-${stat.color}-50 rounded-bl-[4rem] transition-all group-hover:scale-110`} />
                  <stat.icon className={`text-${stat.color}-500 mb-6 relative z-10`} size={32} />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-1 relative z-10">{stat.label}</p>
                  <p className="text-3xl font-black text-stone-900 relative z-10">{stat.value}</p>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'logs' && (
            <motion.div 
              key="logs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-stone-900">Real-time Gemini Logs</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Timestamp</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">User ID</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Feature</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Model</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Tokens</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {logs.map(log => (
                      <tr key={log.id} className="font-mono text-[11px]">
                        <td className="px-6 py-3 text-stone-500">{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td className="px-6 py-3 text-indigo-600 font-bold">{log.userId.slice(0, 8)}...</td>
                        <td className="px-6 py-3">
                           <span className="px-2 py-0.5 bg-stone-100 rounded-md uppercase font-bold">{log.feature}</span>
                        </td>
                        <td className="px-6 py-3">{log.model}</td>
                        <td className="px-6 py-3 font-bold text-emerald-600">{log.totalTokens}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'schools' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {schools.map(school => (
                 <div key={school.id} className="bg-white p-8 rounded-[3rem] border border-stone-200 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
                   <div className="flex items-center justify-between mb-8">
                     <div className="flex items-center space-x-4">
                       <div className="w-16 h-16 bg-stone-100 rounded-3xl flex items-center justify-center text-stone-400">
                         <SchoolIcon size={32} />
                       </div>
                       <div>
                         <h3 className="text-lg font-black text-stone-900">{school.name}</h3>
                         <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{school.city}, {school.state}</p>
                       </div>
                     </div>
                     <button className="p-3 hover:bg-stone-100 rounded-2xl transition-colors">
                       <SettingIcon size={20} className="text-stone-400" />
                     </button>
                   </div>

                   {/* Enrollment Code Section */}
                   <div className="mb-8 bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                          <Key size={18} />
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">School Enrollment Code</p>
                          <div className="flex items-center space-x-2">
                             <p className="text-lg font-black text-indigo-900 tracking-wider uppercase">{school.schoolCode}</p>
                             <button 
                               onClick={() => copyToClipboard(school.schoolCode, school.id)}
                               className="p-1.5 hover:bg-indigo-100 rounded-lg transition-all text-indigo-400 hover:text-indigo-600"
                               title="Copy Code"
                             >
                               {copiedCodeId === school.id ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
                             </button>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => regenerateSchoolCode(school.id, school.name)}
                        className="p-2 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"
                        title="Regenerate Code"
                      >
                        <RefreshCw size={16} />
                      </button>
                   </div>

                   <div className="flex space-x-4">
                     <div className="flex-1 bg-stone-50 p-6 rounded-2xl text-center">
                       <FileText className="mx-auto text-indigo-500 mb-2" size={20} />
                       <p className="text-2xl font-black text-stone-900">{school.submissionCount}</p>
                       <p className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Submissions</p>
                     </div>
                     <div className="flex-1 bg-stone-50 p-6 rounded-2xl text-center">
                       <Users className="mx-auto text-emerald-500 mb-2" size={20} />
                       <p className="text-2xl font-black text-stone-900">{school.userCount}</p>
                       <p className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Enrollments</p>
                     </div>
                   </div>
                   
                   <div className="mt-6 pt-6 border-t flex flex-wrap gap-4 items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center">
                          <Plus size={14} className="text-stone-400" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest">Primary Contact</p>
                          <p className="text-[11px] font-bold text-stone-700">{school.contactName}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                         <button 
                           onClick={() => {
                             setInviteSchoolId(school.id);
                             setInviteEmail(school.contactEmail);
                             setIsInvitingAdmin(true);
                             setInviteLink(null);
                           }}
                           className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors"
                         >
                           Invite School Admin
                         </button>
                        <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${
                          school.status === 'Active' ? 'bg-emerald-100 text-emerald-600' : 
                          school.status === 'Pilot' ? 'bg-indigo-100 text-indigo-600' :
                          school.status === 'Paused' ? 'bg-amber-100 text-amber-600' :
                          'bg-stone-100 text-stone-500'
                        }`}>
                          {school.status}
                        </span>
                        <span className="px-3 py-1 bg-stone-100 rounded-full text-[10px] font-black uppercase tracking-widest text-stone-500">{school.schoolType}</span>
                      </div>
                   </div>
                 </div>
               ))}

               {/* New School Placeholder */}
               <button 
                 onClick={() => setIsAddingSchool(true)}
                 className="border-2 border-dashed border-stone-200 p-8 rounded-[3rem] flex flex-col items-center justify-center space-y-4 hover:border-indigo-300 hover:bg-indigo-50/10 transition-all text-stone-400 hover:text-indigo-500 min-h-[200px]"
               >
                  <div className="w-16 h-16 border-2 border-current rounded-3xl flex items-center justify-center">
                    <Plus size={32} />
                  </div>
                  <span className="text-sm font-black uppercase tracking-[0.2em]">Add New Institution</span>
               </button>
             </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminMode;
