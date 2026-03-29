import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Apple, Lock, Mail, Loader2, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Login() {
  const { login, signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false); // Toggle to allow creating the first account

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      if (isSignUp) {
        const cred = await signup(email, password);
        const username = email.split('@')[0];
        await setDoc(doc(db, 'users', cred.user.uid), {
          email: email,
          username: username,
          role: 'Admin',
          createdAt: new Date().toISOString()
        });
      } else {
        let loginEmail = email;
        if (!email.includes('@')) {
          const q = query(collection(db, 'users'), where('username', '==', email));
          const snap = await getDocs(q);
          if (snap.empty) {
            throw new Error('المستخدم غير موجود');
          }
          loginEmail = snap.docs[0].data().email;
        }
        await login(loginEmail, password);
      }
    } catch (err) {
      console.error(err);
      setError(isSignUp ? 'حدث خطأ أثناء إنشاء الحساب، ربما مسجل مسبقاً أو كلمة المرور ضعيفة.' : 'فشل تسجيل الدخول. يرجى التحقق من بياناتك.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 font-['Cairo']" dir="rtl">
      {/* Background Ambience */}
      <div className="absolute top-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[700px] h-[700px] rounded-full bg-blue-600/10 blur-[120px]"></div>
        <div className="absolute -bottom-[20%] -left-[10%] w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[100px]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden relative z-10 border border-slate-100/50"
      >
        <div className="p-10">
          <div className="flex flex-col items-center justify-center mb-10">
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-white shadow-[0_8px_30px_rgba(79,70,229,0.3)] mb-6 transform -rotate-6 hover:rotate-0 transition-all duration-300 ${isSignUp ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}>
              {isSignUp ? <UserPlus size={40} strokeWidth={2} /> : <Apple size={40} strokeWidth={2} />}
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight text-center">
              بركة الثمار <span className={isSignUp ? "text-emerald-600" : "text-blue-600"}>PRO</span>
            </h1>
            <p className="text-slate-500 font-medium mt-2 text-center text-sm">
              {isSignUp ? 'قم بإنشاء حساب المدير الافتراضي الأول' : 'قم بتسجيل الدخول للوصول إلى لوحة القيادة'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 text-sm font-bold border border-red-100 text-center animate-pulse">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">البريد الإلكتروني / المستخدم</label>
              <div className="relative group">
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <Mail size={20} />
                </div>
                <input 
                  type="text" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-semibold rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 block pr-12 pl-4 py-3.5 outline-none transition-all"
                  placeholder="admin@barakat.com أو اسم المستخدم"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-slate-700">كلمة المرور</label>
                {!isSignUp && <a href="#" className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">نسيت كلمة المرور؟</a>}
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                  <Lock size={20} />
                </div>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-semibold rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 block w-full pr-12 pl-4 py-3.5 outline-none transition-all"
                  placeholder="••••••••"
                  dir="ltr"
                  minLength={6}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className={`w-full text-white font-bold rounded-2xl text-base px-5 py-4 text-center transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-[0_8px_20px_rgba(37,99,235,0.2)] hover:shadow-[0_8px_25px_rgba(37,99,235,0.3)] mt-8 flex items-center justify-center
                ${isSignUp ? 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/20 shadow-[0_8px_20px_rgba(5,150,105,0.2)]' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500/20'}`}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin mr-2 ml-2" size={20} />
                  جاري المعالجة...
                </>
              ) : (
                isSignUp ? 'إنشاء حساب وتأكيد دخول' : 'تسجيل الدخول'
              )}
            </button>
          </form>

          {/* Setup Toggle */}
          <div className="mt-6 text-center">
            <button 
              type="button" 
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-sm font-bold text-slate-500 border-b border-dashed border-slate-300 hover:text-slate-800 hover:border-slate-800 pb-0.5 transition-colors"
            >
              {isSignUp ? 'إلغاء، لدي حساب بالفعل' : 'إعداد: إنشاء حساب مدير جديد (لأول مرة)'}
            </button>
          </div>
        </div>
        
        <div className="bg-slate-50 border-t border-slate-100 p-6 text-center">
          <p className="text-xs font-bold text-slate-400">
            Powered by PRO VISION v2.0
          </p>
        </div>
      </motion.div>
    </div>
  );
}
