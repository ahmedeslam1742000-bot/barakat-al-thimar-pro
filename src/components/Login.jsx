import React, { useEffect, useMemo, useState } from 'react';
import { Apple, Lock, Loader2, Mail, Phone, User, Warehouse } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

const TYPING_TEXT = 'بركة الثمار... دقة، سرعة، أمان.';

/* ───────────────────────────────────────────
   SocialButton – monochromatic grey outlined
─────────────────────────────────────────── */
function SocialButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-[50px] w-[50px] items-center justify-center border-[1.5px] border-slate-200 rounded-full bg-white text-slate-400 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-600 hover:bg-slate-50/70"
    >
      {children}
    </button>
  );
}

/* ───────────────────────────────────────────
   FormField – reusable rounded-full input
─────────────────────────────────────────── */
function FormField({ label, icon, inputClassName = '', ...props }) {
  const Icon = icon;
  return (
    <div className="w-full">
      <label className="mb-1.5 block text-[13px] font-medium text-slate-500 font-readex">{label}</label>
      <div className="relative">
        <input
          {...props}
          className={`h-[46px] w-full rounded-full border border-slate-200 bg-slate-50 py-2 pr-11 pl-4 text-sm text-slate-800 shadow-sm outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100/60 ${inputClassName}`}
        />
        <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">
          <Icon size={16} />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────
   FluidBackground – subtle organic curves
─────────────────────────────────────────── */
function FluidBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.07]"
        viewBox="0 0 800 800"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <path d="M-20 170C112 96 229 257 355 205C474 157 532 62 670 106C733 126 771 157 820 196" stroke="#10B981" strokeWidth="2">
          <animate attributeName="d" dur="14s" repeatCount="indefinite" values="M-20 170C112 96 229 257 355 205C474 157 532 62 670 106C733 126 771 157 820 196;M-20 196C105 253 234 101 353 143C490 192 562 266 681 214C741 188 771 152 820 128;M-20 170C112 96 229 257 355 205C474 157 532 62 670 106C733 126 771 157 820 196" />
        </path>
        <path d="M-30 430C114 355 218 528 369 460C513 395 596 296 731 357C769 374 790 390 836 425" stroke="#10B981" strokeWidth="1.5">
          <animate attributeName="d" dur="18s" repeatCount="indefinite" values="M-30 430C114 355 218 528 369 460C513 395 596 296 731 357C769 374 790 390 836 425;M-30 408C85 506 237 332 369 377C532 432 611 513 731 473C776 458 794 443 836 424;M-30 430C114 355 218 528 369 460C513 395 596 296 731 357C769 374 790 390 836 425" />
        </path>
        <path d="M52 685C182 622 259 727 399 676C520 632 590 571 726 615" stroke="#10B981" strokeWidth="1.2">
          <animate attributeName="d" dur="20s" repeatCount="indefinite" values="M52 685C182 622 259 727 399 676C520 632 590 571 726 615;M40 650C162 734 260 615 404 626C529 636 615 690 736 653;M52 685C182 622 259 727 399 676C520 632 590 571 726 615" />
        </path>
      </svg>
      {/* Particles */}
      <div className="absolute left-[15%] top-[20%] h-1.5 w-1.5 rounded-full bg-emerald-400/20 animate-ping" />
      <div className="absolute left-[30%] bottom-[25%] h-2 w-2 rounded-full bg-emerald-300/25 animate-pulse" />
      <div className="absolute right-[20%] top-[45%] h-1 w-1 rounded-full bg-emerald-400/30 animate-bounce" />
      <div className="absolute right-[35%] bottom-[15%] h-1.5 w-1.5 rounded-full bg-emerald-500/15 animate-pulse" />
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN LOGIN COMPONENT
═══════════════════════════════════════════ */
export default function Login() {
  const { login, signup } = useAuth();

  /* State */
  const [mode, setMode] = useState('login');                // 'login' | 'signup'
  const [visibleForm, setVisibleForm] = useState('login');   // which form is rendered
  const [formAnimating, setFormAnimating] = useState(false);
  const [typedText, setTypedText] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /* Typing animation */
  useEffect(() => {
    let index = 0;
    setTypedText('');
    const timer = setInterval(() => {
      index += 1;
      setTypedText(TYPING_TEXT.slice(0, index));
      if (index >= TYPING_TEXT.length) clearInterval(timer);
    }, 70);
    return () => clearInterval(timer);
  }, []);

  /* Smooth form switch animation */
  useEffect(() => {
    setFormAnimating(true);

    const switchTimer = setTimeout(() => {
      setVisibleForm(mode);
    }, 180);

    const doneTimer = setTimeout(() => {
      setFormAnimating(false);
    }, 500);

    return () => {
      clearTimeout(switchTimer);
      clearTimeout(doneTimer);
    };
  }, [mode]);

  const isLogin = visibleForm === 'login';

  const activeTitle = useMemo(
    () => (visibleForm === 'signup' ? 'إنشاء حساب جديد' : 'تسجيل الدخول'),
    [visibleForm]
  );

  const activeSubtitle = useMemo(
    () =>
      visibleForm === 'signup'
        ? 'أكمل البيانات التالية للوصول إلى تجربة إدارة أكثر سلاسة.'
        : 'أدخل بريدك الإلكتروني وكلمة المرور للمتابعة إلى النظام.',
    [visibleForm]
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
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
        sessionStorage.setItem('auth_token', 'active');
      } else {
        const cred = await signup(email, password);

        await setDoc(doc(db, 'users', cred.user.uid), {
          email,
          username: email.split('@')[0],
          fullName,
          phone,
          role: 'User',
          createdAt: new Date().toISOString(),
        });
        sessionStorage.setItem('auth_token', 'active');
      }
    } catch (err) {
      console.error(err);
      setError(
        mode === 'login'
          ? 'فشل تسجيل الدخول. يرجى التحقق من بياناتك.'
          : 'حدث خطأ أثناء إنشاء الحساب. حاول لاحقاً.'
      );
    } finally {
      setLoading(false);
    }
  }

  /* ───────────────────────────────────────────
     RENDER
  ─────────────────────────────────────────── */
  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100" dir="rtl">
      <div className="flex h-full w-full flex-row">

        {/* ══════════════════════════════════════
            RIGHT PANEL — Brand Welcome (60%)
            Deep Navy #0F2747
        ══════════════════════════════════════ */}
        <section className="relative flex h-full w-[60%] flex-col items-center justify-center overflow-hidden bg-[#0F2747] lg:rounded-l-[36px]">
          <FluidBackground />

          <div className="relative z-10 flex flex-col items-center text-center px-8 max-w-lg">

            {/* Logo */}
            <div className="mb-8 flex h-28 w-28 items-center justify-center rounded-[32px] bg-white/10 backdrop-blur-md shadow-[0_12px_40px_rgba(0,0,0,0.25)] border border-white/10">
              <Warehouse size={52} className="text-emerald-400" />
            </div>

            {/* Brand name */}
            <h1 className="mb-3 text-[36px] font-bold text-white font-tajawal tracking-wide">
              بركة الثمار
            </h1>

            {/* Typing animation */}
            <div className="mb-10 min-h-[60px] max-w-[340px] text-[17px] font-medium leading-relaxed text-emerald-200/80 font-tajawal">
              {typedText}
              <span className="mr-1 inline-block h-[18px] w-[2px] animate-pulse bg-emerald-400 align-middle" />
            </div>

            {/* ── Capsule Toggle Buttons ── */}
            <div className="flex w-full max-w-[300px] gap-3">
              {/* تسجيل الدخول */}
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className={`flex-1 rounded-full px-6 py-3.5 text-[14px] font-semibold transition-all duration-400 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] font-tajawal ${
                  mode === 'login'
                    ? 'bg-[#10B981] text-white shadow-[0_8px_24px_rgba(16,185,129,0.35)] scale-[1.03]'
                    : 'border border-emerald-400/30 bg-transparent text-emerald-300 hover:bg-emerald-400/10'
                }`}
              >
                تسجيل الدخول
              </button>

              {/* إنشاء حساب */}
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(''); }}
                className={`flex-1 rounded-full px-6 py-3.5 text-[14px] font-semibold transition-all duration-400 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] font-tajawal ${
                  mode === 'signup'
                    ? 'bg-[#10B981] text-white shadow-[0_8px_24px_rgba(16,185,129,0.35)] scale-[1.03]'
                    : 'border border-emerald-400/30 bg-transparent text-emerald-300 hover:bg-emerald-400/10'
                }`}
              >
                إنشاء حساب
              </button>
            </div>

          </div>
        </section>

        {/* ══════════════════════════════════════
            LEFT PANEL — Form Panel (40%)
            Pure White, slides in on toggle
        ══════════════════════════════════════ */}
        <section className="flex h-full w-[40%] items-center justify-center bg-white overflow-hidden px-6 lg:px-10 shadow-[-12px_0_40px_rgba(0,0,0,0.06)]">
          <div className="w-full max-w-[400px]">

            {/* Sliding form container */}
            <div
              className={`transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
                formAnimating ? 'translate-x-10 opacity-0' : 'translate-x-0 opacity-100'
              }`}
            >

              {/* Title & subtitle */}
              <div className="mb-8 text-center text-[#0F2747]">
                <h2 className="mb-2.5 text-[26px] font-bold text-[#0F2747] font-tajawal">
                  {activeTitle}
                </h2>
                <p className="text-[13.5px] text-slate-500 font-readex leading-relaxed max-w-[90%] mx-auto">
                  {activeSubtitle}
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-600 font-readex">
                  {error}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {visibleForm === 'signup' && (
                  <FormField
                    label="الاسم الكامل"
                    icon={User}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="أدخل اسمك الكامل"
                    dir="rtl"
                    autoComplete="name"
                  />
                )}

                <FormField
                  label={visibleForm === 'signup' ? 'البريد الإلكتروني' : 'البريد الإلكتروني / اسم المستخدم'}
                  icon={Mail}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={visibleForm === 'signup' ? 'admin@barakat.com' : 'username أو email'}
                  dir="ltr"
                  required
                  autoComplete={visibleForm === 'signup' ? 'email' : 'username'}
                />

                {visibleForm === 'signup' && (
                  <FormField
                    label="رقم الهاتف"
                    icon={Phone}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="05xxxxxxxxx"
                    dir="ltr"
                    autoComplete="tel"
                  />
                )}

                <FormField
                  label="كلمة المرور"
                  icon={Lock}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  dir="ltr"
                  type="password"
                  required
                  autoComplete={visibleForm === 'signup' ? 'new-password' : 'current-password'}
                />

                {/* Forgot password (login only) */}
                {visibleForm === 'login' && (
                  <div className="text-center -mt-1">
                    <button
                      type="button"
                      className="text-[13px] text-slate-400 hover:text-emerald-500 transition-colors duration-200 font-readex"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  </div>
                )}

                {/* Submit */}
                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center rounded-full bg-[#10B981] px-6 py-4 text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(16,185,129,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-[0_12px_28px_rgba(16,185,129,0.35)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 font-tajawal"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        جارٍ المعالجة...
                      </span>
                    ) : visibleForm === 'signup' ? (
                      'إنشاء الحساب'
                    ) : (
                      'تسجيل الدخول'
                    )}
                  </button>
                </div>
              </form>

              {/* Social Login Divider */}
              <div className="mt-8 border-t border-slate-100 pt-6">
                <p className="mb-5 text-center text-[12.5px] text-slate-400 font-readex">
                  أو المتابعة بوسيلة أخرى
                </p>

                <div className="flex items-center justify-center gap-3.5">
                  <SocialButton
                    label="Google"
                    onClick={() => setError('تسجيل الدخول عبر Google غير متاح حالياً.')}
                  >
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <path d="M21.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.1h5.3c-.2 1.3-1 2.5-2 3.1v2.6h3.2c1.9-1.8 3-4.4 3-7.6z"/>
                      <path d="M12 22c2.7 0 4.9-.9 6.5-2.4l-3.2-2.6c-.9.6-2 .9-3.3.9-2.5 0-4.6-1.7-5.4-4H3.3v2.6C4.9 19.8 8.2 22 12 22z"/>
                      <path d="M6.6 13.9c-.2-.6-.3-1.3-.3-1.9s.1-1.3.3-1.9V7.5H3.3a9.9 9.9 0 0 0 0 9l3.3-2.6z"/>
                      <path d="M12 5.8c1.4 0 2.7.5 3.7 1.4l2.8-2.8C16.9 2.5 14.7 1.6 12 1.6 8.2 1.6 4.9 3.8 3.3 7.5l3.3 2.6c.8-2.3 2.9-4.3 5.4-4.3z"/>
                    </svg>
                  </SocialButton>

                  <SocialButton
                    label="Apple"
                    onClick={() => setError('تسجيل الدخول عبر Apple غير متاح حالياً.')}
                  >
                    <Apple strokeWidth={1.5} className="h-[18px] w-[18px]" />
                  </SocialButton>

                  <SocialButton
                    label="Facebook"
                    onClick={() => setError('تسجيل الدخول عبر Facebook غير متاح حالياً.')}
                  >
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3.81l.38-4h-4.19V7a1 1 0 0 1 1-1h3z"/>
                    </svg>
                  </SocialButton>

                  <SocialButton
                    label="Phone"
                    onClick={() => setError('تسجيل الدخول عبر الهاتف غير متاح حالياً.')}
                  >
                    <Phone strokeWidth={1.5} className="h-[18px] w-[18px]" />
                  </SocialButton>
                </div>
              </div>

            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
