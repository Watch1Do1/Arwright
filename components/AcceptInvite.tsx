
import React, { useState, useEffect } from 'react';
import { auth, signInWithGoogle } from '../services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, LogIn, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

interface AcceptInviteProps {
  token: string;
}

const AcceptInvite: React.FC<AcceptInviteProps> = ({ token }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [errorMessage, setErrorMessage] = useState('');
  const [schoolId, setSchoolId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleAccept = async () => {
    if (!user) {
      try {
        await signInWithGoogle();
      } catch (err: any) {
        setStatus('ERROR');
        setErrorMessage(err.message);
      }
      return;
    }

    setStatus('PROCESSING');
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, idToken })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to accept invite');
      }

      // Refresh the token so it carries the new School Admin role
      await auth.currentUser?.getIdToken(true);

      setStatus('SUCCESS');
      setSchoolId(result.schoolId);
    } catch (err: any) {
      console.error(err);
      setStatus('ERROR');
      setErrorMessage(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[3rem] border border-stone-200 shadow-2xl overflow-hidden"
      >
        <div className="p-12 text-center">
          <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-8 ${
            status === 'ERROR' ? 'bg-rose-100 text-rose-600' : 
            status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-600' :
            'bg-indigo-100 text-indigo-600'
          }`}>
            {status === 'ERROR' ? <AlertCircle size={40} /> : 
             status === 'SUCCESS' ? <CheckCircle2 size={40} /> :
             <ShieldCheck size={40} />}
          </div>

          <h2 className="text-2xl font-black text-stone-900 mb-2 underline underline-offset-8 decoration-indigo-500/20">
            {status === 'SUCCESS' ? "Welcome, Administrator" : "Institutional Authority Invitation"}
          </h2>
          
          <p className="text-stone-500 text-sm mb-10">
            {status === 'SUCCESS' ? "Your account has been promoted. You now have administrative oversight for your school." :
             status === 'ERROR' ? errorMessage :
             "You have been invited to manage your institution's Arwright deployment. Please verify your identity."}
          </p>

          <AnimatePresence mode="wait">
            {status === 'SUCCESS' ? (
              <motion.button
                key="success"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => window.location.href = '/'}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-emerald-200 flex items-center justify-center space-x-3"
              >
                <span>Enter Dashboard</span>
                <ArrowRight size={18} />
              </motion.button>
            ) : status === 'PROCESSING' ? (
              <motion.div key="processing" className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce delay-200"></div>
              </motion.div>
            ) : (
              <motion.button
                key="action"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={handleAccept}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-200 flex items-center justify-center space-x-3"
              >
                {!user ? <LogIn size={20} /> : <CheckCircle2 size={20} />}
                <span>{!user ? "Sign in to Accept" : "Verify & Accept Role"}</span>
              </motion.button>
            )}
          </AnimatePresence>

          {status === 'ERROR' && (
            <button 
              onClick={() => setStatus('IDLE')}
              className="mt-6 text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-600"
            >
              Try Again
            </button>
          )}

          {!user && status === 'IDLE' && (
            <p className="mt-8 text-[10px] font-black text-stone-400 uppercase tracking-widest">
              Use your school email address to authenticate.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AcceptInvite;
