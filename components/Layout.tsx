
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, PenTool, LayoutDashboard, LogOut, ShieldAlert } from 'lucide-react';
import { UserRole, UserProfile as ProfileType } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  role: UserRole;
  setRole: (role: UserRole) => void;
  isDarkMode: boolean;
  user?: any;
  userProfile?: ProfileType | null;
  onLogout?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, role, setRole, isDarkMode, user, userProfile, onLogout }) => {

  return (
    <div className={`fixed inset-0 flex flex-col overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-stone-950 text-white' : 'bg-[#F0F2F5] text-stone-900'}`}>
      <header className={`border-b py-3 px-6 flex justify-between items-center shrink-0 shadow-sm print:hidden ${isDarkMode ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'}`}>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 flex items-center justify-center rounded-xl font-bold text-2xl text-white shadow-lg shadow-indigo-200 serif">A</div>
          <div className="flex flex-col">
            <span className={`text-sm font-black tracking-[0.2em] uppercase leading-none ${isDarkMode ? 'text-stone-100' : 'text-stone-800'}`}>Arwright</span>
            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">Academic Mentor</span>
          </div>
          {userProfile?.uid === 'demo-user-123' && (
            <div className="ml-4 px-3 py-1 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full animate-pulse shadow-lg shadow-amber-200 dark:shadow-none">
              Demo Mode Active
            </div>
          )}
        </div>
        
        <nav className={`flex space-x-1 p-1 rounded-2xl border ${isDarkMode ? 'bg-stone-800 border-stone-700' : 'bg-stone-100 border-stone-200/50'}`}>
          <button 
            onClick={() => setRole(UserRole.STUDENT)}
            className={`flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${role === UserRole.STUDENT ? (isDarkMode ? 'bg-stone-700 text-white shadow-sm' : 'bg-white text-indigo-600 shadow-sm') : (isDarkMode ? 'text-stone-400 hover:text-stone-200' : 'text-stone-400 hover:text-stone-600')}`}
          >
            <PenTool size={14} />
            <span className="hidden sm:inline">Workspace</span>
          </button>
          <button 
            onClick={() => setRole(UserRole.TEACHER)}
            className={`flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${role === UserRole.TEACHER ? (isDarkMode ? 'bg-stone-700 text-white shadow-sm' : 'bg-white text-indigo-600 shadow-sm') : (isDarkMode ? 'text-stone-400 hover:text-stone-200' : 'text-stone-400 hover:text-stone-600')}`}
          >
            <LayoutDashboard size={14} />
            <span className="hidden sm:inline">Console</span>
          </button>
          
          {userProfile?.role === UserRole.ADMIN && (
            <button 
              onClick={() => setRole(UserRole.ADMIN)}
              className={`flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${role === UserRole.ADMIN ? (isDarkMode ? 'bg-stone-700 text-white shadow-sm' : 'bg-white text-red-600 shadow-sm') : (isDarkMode ? 'text-stone-400 hover:text-stone-200' : 'text-stone-400 hover:text-stone-600')}`}
            >
              <ShieldAlert size={14} />
              <span className="hidden sm:inline">Admin</span>
            </button>
          )}
        </nav>

        <div className="flex items-center space-x-6">
           <div className="hidden md:flex items-center space-x-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-800 text-[10px] font-black uppercase tracking-wider">
             <ShieldCheck size={12} />
             <span>Secure</span>
           </div>

           {user && (
             <div className={`flex items-center space-x-2 pl-4 border-l ${isDarkMode ? 'border-stone-800' : 'border-stone-200'}`}>
               <div className="flex flex-col items-end mr-1 hidden sm:flex">
                 <span className={`text-[10px] font-black uppercase tracking-tight ${isDarkMode ? 'text-stone-300' : 'text-stone-800'}`}>
                   {userProfile?.firstName || user.displayName?.split(' ')[0]}
                 </span>
                 <span className="text-[8px] text-stone-400 font-bold uppercase tracking-widest">
                   {role === UserRole.STUDENT ? 'Scholar' : role === UserRole.TEACHER ? 'Instructor' : 'Administrator'}
                 </span>
               </div>
               <img src={user.photoURL || ''} className="w-8 h-8 rounded-xl border-2 border-white dark:border-stone-800 shadow-sm" alt="" />
               <button 
                onClick={onLogout}
                className={`flex items-center space-x-2 px-3 py-2 rounded-xl transition-all border ${isDarkMode ? 'border-stone-800 hover:bg-stone-800 text-stone-500 hover:text-rose-400' : 'border-stone-200 hover:bg-rose-50 text-stone-400 hover:text-rose-600 hover:border-rose-200'}`}
               >
                 <LogOut size={14} />
                 <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Sign Out</span>
               </button>
             </div>
           )}
        </div>
      </header>
      
      <main className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={role}
            initial={{ opacity: 0, x: role === UserRole.STUDENT ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: role === UserRole.STUDENT ? 20 : -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex-1 flex flex-col min-h-0 w-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Layout;
