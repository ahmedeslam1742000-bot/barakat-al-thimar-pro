import React, { useState } from 'react';
import { Apple, Globe, Loader2, Mail, Phone, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const socialProviders = [
  {
    name: 'Google',
    icon: Globe,
    color: 'bg-[#4285F4]',
    label: 'Google',
  },
  {
    name: 'Apple',
    icon: Apple,
    color: 'bg-black',
    label: 'Apple',
  },
  {
    name: 'Facebook',
    icon: Users,
    color: 'bg-[#1877F2]',
    label: 'Facebook',
  },
  {
    name: 'Phone',
    icon: Phone,
    color: 'bg-[#22C55E]',
    label: 'Phone',
  },
];

export default function Register({ onBack }) {
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      const cred = await signup(email, password);
      const username = email.split('@')[0];
      await setDoc(doc(db, 'users', cred.user.uid), {
        email,
        username,
        role: 'Admin',
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(err);
      setError('حدث خطأ أثناء إنشاء الحساب. يرجى المحاولة مرة أخرى.');
      setLoading(false);
    }
  }

  function handleSocialClick(provider) {
    setError(`تسجيل الدخول عبر ${provider} غير متوفر حالياً.`);
  }

  return (
    <div className="relative z-10">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-sm text-text-secondary-light font-medium font-readex mb-2">ابدأ بحساب جديد</p>
          <h2 className="text-3xl sm:text-4xl font-semibold font-tajawal text-text-primary-light tracking-tight leading-tight">
            إنشاء حساب جديد
          </h2>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-semibold text-secondary hover:text-primary transition-colors"
        >
          العودة لتسجيل الدخول
        </button>
      </div>

      <p className="text-sm text-text-secondary-light font-readex leading-relaxed mb-8">
        تسجيل حساب جديد يبدأ بخيارات التسجيل الاجتماعي أولاً ثم نموذج قياسي بسيط.
      </p>

      {error && (
        <div className="bg-status-danger/10 border border-status-danger/20 text-status-danger rounded-2xl p-4 mb-6 text-sm font-semibold">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-3 justify-center text-xs uppercase tracking-[0.28em] font-bold text-slate-500">
          <span className="h-px flex-1 bg-slate-200"></span>
          أو تابع باستخدام
          <span className="h-px flex-1 bg-slate-200"></span>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {socialProviders.map((provider) => {
            const Icon = provider.icon;
            return (
              <button
                key={provider.name}
                type="button"
                onClick={() => handleSocialClick(provider.name)}
                className={`${provider.color} rounded-full h-14 w-14 flex items-center justify-center shadow-lg shadow-slate-900/10 transition-transform hover:-translate-y-0.5`}
                aria-label={provider.label}
              >
                <Icon size={20} className="text-white" />
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-center text-sm text-text-secondary-light font-readex mt-6">أو أكمل النموذج أدناه لإنشاء حسابك مباشرةً.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label className="block text-xs font-bold text-text-secondary-light mb-2 uppercase tracking-wider">البريد الإلكتروني</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-50 border border-border-light rounded-[1.5rem] px-4 py-4 text-sm text-text-primary-light focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all"
            placeholder="your@email.com"
            dir="ltr"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-text-secondary-light mb-2 uppercase tracking-wider">كلمة المرور</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-50 border border-border-light rounded-[1.5rem] px-4 py-4 text-sm text-text-primary-light focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all"
            placeholder="••••••••"
            dir="ltr"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-text-secondary-light mb-2 uppercase tracking-wider">تأكيد كلمة المرور</label>
          <input
            type="password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-slate-50 border border-border-light rounded-[1.5rem] px-4 py-4 text-sm text-text-primary-light focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary transition-all"
            placeholder="••••••••"
            dir="ltr"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-accent text-white py-4 text-sm font-semibold shadow-2xl shadow-accent/20 hover:bg-accent-light transition-all disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin ml-2 inline-block" size={18} />
              جاري إنشاء الحساب...
            </>
          ) : (
            'إنشاء حساب وتسجيل الدخول'
          )}
        </button>
      </form>
    </div>
  );
}
