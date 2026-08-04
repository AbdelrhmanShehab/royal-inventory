import React, { useState, useMemo } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { User, Lock, Eye, EyeOff, AlertCircle, ShieldAlert, Info, ArrowRight, XCircle } from 'lucide-react';
import { ROUTES } from '../../utils/constants';
import { validateUsername, validatePassword, sanitizeInput } from '../../utils/verification';

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [usernameTouched, setUsernameTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);

  // Check if redirected due to session expiration
  const isSessionExpired = searchParams.get('expired') === 'true';

  // If already authenticated, redirect to dashboard immediately
  if (isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  // Real-time verification results
  const usernameValidation = useMemo(() => validateUsername(username), [username]);
  const passwordValidation = useMemo(() => validatePassword(password), [password]);

  const handleKeyDownPassword = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setIsCapsLockOn(e.getModifierState && e.getModifierState('CapsLock'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameTouched(true);
    setPasswordTouched(true);
    setPasswordError(null);

    const cleanUsername = sanitizeInput(username);

    const uValid = validateUsername(cleanUsername);
    const pValid = validatePassword(password);

    if (!uValid.isValid) {
      setErrorMsg(uValid.error);
      return;
    }
    if (!pValid.isValid) {
      setErrorMsg(pValid.error);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await login(cleanUsername, password);
      // Success: redirect to dashboard
      navigate(ROUTES.DASHBOARD);
    } catch (err: any) {
      console.error('Login error:', err);
      const status = err.response?.status;
      const backendMessage = err.response?.data?.message;
      const backendErrors = err.response?.data?.errors;

      let extractedPassError: string | null = null;

      if (Array.isArray(backendErrors) && backendErrors.length > 0) {
        const passErrObj = backendErrors.find((e: any) => e.field === 'password');
        if (passErrObj) {
          extractedPassError = passErrObj.message || passErrObj.msg;
        }
      }

      if (extractedPassError) {
        setPasswordError(extractedPassError);
      } else if (status === 401) {
        setPasswordError('كلمة المرور غير صحيحة. يرجى إعادة كتابة كلمة المرور بالشكل الصحيح.');
      } else if (status === 400) {
        setPasswordError('بيانات كلمة المرور أو اسم المستخدم غير صحيحة.');
      }

      if (status === 401) {
        setErrorMsg('كلمة المرور أو اسم المستخدم غير صحيح. يرجى التأكد من البيانات والمحاولة مجدداً.');
      } else if (backendErrors && Array.isArray(backendErrors) && backendErrors.length > 0) {
        setErrorMsg(backendErrors.map((e: any) => e.message || e.msg).join(' | '));
      } else if (backendMessage) {
        setErrorMsg(backendMessage);
      } else if (status === 403) {
        setErrorMsg('حساب المستخدم معطل أو غير مصرح له بالدخول إلى النظام. يرجى التواصل مع مسؤول النظام.');
      } else if (status === 404) {
        setErrorMsg('اسم المستخدم غير موجود بالنظام. يرجى التثبت من اسم المستخدم.');
      } else if (status === 429) {
        setErrorMsg('تم تجاوز عدد محاولات الدخول الخاطئة المسموح بها. يرجى الانتظار بضع دقائق ثم المحاولة.');
      } else if (err.message === 'Network Error' || !err.response) {
        setErrorMsg('تعذر الاتصال بالخادم. يرجى التحقق من اتصال الشبكة وتشغيل الخادم Backend.');
      } else {
        setErrorMsg('حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex bg-slate-50 font-sans" dir="rtl">
      {/* Visual / Branding Side (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-radial from-slate-900 via-indigo-950 to-slate-950 text-white flex-col justify-between p-12">
        {/* Subtle mesh background effect */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-20"></div>
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500 rounded-full blur-[120px] opacity-20 pointer-events-none"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-brand-500 rounded-full blur-[120px] opacity-25 pointer-events-none"></div>

        {/* Top Header/Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-brand-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <span className="text-white font-extrabold text-xl tracking-tight">R</span>
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-wide bg-clip-text text-transparent bg-gradient-to-l from-white via-slate-100 to-slate-300">
              Royal Inventory System
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider -mt-1 uppercase">
              إدارة المخازن
            </p>
          </div>
        </div>

        {/* Middle Welcome Text */}
        <div className="relative z-10 my-auto max-w-lg">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-400 mb-6">
            <ShieldAlert size={14} /> نظام التحقق والدخول الآمن
          </span>
          <h2 className="text-4xl font-extrabold leading-tight text-white mb-4">
            إدارة أصولك ومخزونك <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-l from-blue-400 to-emerald-400">
              بأمان ودقة فائقة
            </span>
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-8">
            مرحباً بك في نظام إدارة المخزون المركزي. يرجى إدخال اسم المستخدم وكلمة المرور الخاصة بك لتسجيل الدخول والوصول إلى لوحة التحكم.
          </p>

          {/* Key Value Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
              <h3 className="text-sm font-bold text-white mb-1">تتبع فوري</h3>
              <p className="text-xs text-slate-400">مراقبة حية لكافة حركات المخزون والمستندات.</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
              <h3 className="text-sm font-bold text-white mb-1">حماية معززة</h3>
              <p className="text-xs text-slate-400">توثيق العمليات عبر تشفير وصلاحيات متطورة.</p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-slate-400 flex items-center justify-between w-full select-none">
          <span className="tracking-wide opacity-70">Royal Inventory System &copy; 2026</span>

          <div className="flex items-center gap-2">
            <span className="text-white px-4 py-2 bg-blue-500/80 text-[12px] rounded-full font-bold shadow-sm border border-slate-200/20">
              م\ عبد الرحمن حسام
            </span>

            <span className="text-white px-4 py-2 bg-blue-500/80 text-[12px] rounded-full font-bold shadow-sm border border-slate-200/20">
              م\ محمد سمير
            </span>
          </div>
        </div>
      </div>

      {/* Login Form Side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 md:p-16">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-2xl shadow-slate-100 p-8 transition-all duration-300 hover:shadow-slate-200/60">

          {/* Logo representation on mobile */}
          <div className="lg:hidden flex items-center gap-3 justify-center mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-brand-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-extrabold text-xl">R</span>
            </div>
            <div className="text-right">
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Royal Inventory System</h1>
              <p className="text-[10px] text-slate-500 font-semibold uppercase">مخازن نادي رويال</p>
            </div>
          </div>

          <div className="text-right mb-6">
            <h2 className="text-2xl font-black text-slate-900">تسجيل الدخول</h2>
            <p className="text-sm text-slate-500 mt-1.5 font-medium">أدخل تفاصيل حسابك للوصول إلى لوحة التحكم</p>
          </div>

          {/* Session Expired Banner */}
          {isSessionExpired && !errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-right animate-fade-in">
              <Info className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <div className="flex-1">
                <h4 className="text-xs font-bold text-amber-900">انتهت صلاحية الجلسة</h4>
                <p className="text-xs text-amber-700 mt-0.5 font-medium">انتهت جلسة العمل الخاصة بك. يرجى إدخال بيانات حسابك لتسجيل الدخول مجدداً.</p>
              </div>
            </div>
          )}

          {/* Detailed Error Message Banner */}
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border-2 border-red-200 flex items-start gap-3 animate-fade-in text-right shadow-sm">
              <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={22} />
              <div className="flex-1">
                <h4 className="text-sm font-black text-red-900">خطأ في بيانات الدخول</h4>
                <p className="text-xs text-red-800 mt-1 font-bold leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Username Field */}
            <div className="space-y-1.5 text-right">
              <label htmlFor="username" className="text-xs font-bold text-slate-700 select-none">
                اسم المستخدم <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  placeholder="أدخل اسم المستخدم الخاص بك"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  onBlur={() => setUsernameTouched(true)}
                  disabled={isSubmitting}
                  className={`w-full h-11 pr-10 pl-10 bg-slate-50 border rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white transition-all duration-200 disabled:opacity-50 ${
                    usernameTouched && !usernameValidation.isValid
                      ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
                      : 'border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10'
                  }`}
                  required
                  autoComplete="username"
                />
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <User size={18} />
                </div>
                {usernameTouched && !usernameValidation.isValid && (
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-red-500">
                    <XCircle size={16} />
                  </div>
                )}
              </div>
              {usernameTouched && !usernameValidation.isValid && usernameValidation.error && (
                <p className="text-[11px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {usernameValidation.error}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5 text-right">
              <label htmlFor="password" className="text-xs font-bold text-slate-700 select-none">
                كلمة المرور <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="أدخل كلمة المرور الخاصة بك"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                    if (passwordError) setPasswordError(null);
                  }}
                  onBlur={() => setPasswordTouched(true)}
                  onKeyDown={handleKeyDownPassword}
                  onKeyUp={handleKeyDownPassword}
                  disabled={isSubmitting}
                  className={`w-full h-11 pr-10 pl-11 bg-slate-50 border rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:bg-white transition-all duration-200 disabled:opacity-50 ${
                    passwordError || (passwordTouched && !passwordValidation.isValid)
                      ? 'border-2 border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 bg-red-50/30'
                      : 'border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10'
                  }`}
                  required
                  autoComplete="current-password"
                />
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-hidden cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Caps Lock Warning */}
              {isCapsLockOn && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200 mt-1 font-semibold">
                  <Info size={13} className="text-amber-600 shrink-0" />
                  <span>تنبيه: زر الحروف الكبيرة (Caps Lock) مفعل</span>
                </div>
              )}

              {/* Password Error Message (Wrong password or empty) */}
              {(passwordError || (passwordTouched && !passwordValidation.isValid && passwordValidation.error)) && (
                <p className="text-[11px] text-red-600 font-extrabold mt-1 flex items-center gap-1">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>{passwordError || passwordValidation.error}</span>
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 mt-2 bg-gradient-to-l from-brand-600 to-blue-600 hover:from-brand-700 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg shadow-brand-500/10 hover:shadow-brand-500/20 active:scale-[0.99] transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>جاري التحقق وتسجيل الدخول...</span>
                </>
              ) : (
                <>
                  <span>تسجيل الدخول</span>
                  <ArrowRight size={16} className="rotate-180" />
                </>
              )}
            </button>
          </form>

          {/* Extra Help Info */}
          <div className="mt-8 text-center border-t border-slate-100 pt-6">
            <p className="text-xs text-slate-400 leading-relaxed font-semibold">
              تواجه مشكلة في تسجيل الدخول؟ يرجى التواصل مع إدارة النظام وقسم الدعم الفني لاستعادة حسابك أو تعديل صلاحياتك.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
