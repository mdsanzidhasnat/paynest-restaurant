import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, CheckCircle2, ArrowLeft } from 'lucide-react';
import { ApiError } from '../../api/client';

interface LoginViewProps {
  onSignIn: (email: string, password: string) => Promise<void>;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSignIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSignIn(email.trim(), password);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetSent(true);
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB] grid grid-cols-1 lg:grid-cols-2">
      {/* Left Side: White Login Card */}
      <div className="flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-[440px] bg-white border border-[#E6EAF0] rounded-[12px] p-8 sm:p-10 shadow-[0_1px_2px_rgba(17,24,39,0.03),0_8px_24px_rgba(17,24,39,0.04)]">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-[10px] bg-[#4F46E5] flex items-center justify-center shadow-xs">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-5 h-5 text-white"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="14" rx="2" />
                <path d="M7 10h4" />
                <path d="M7 14h2" />
                <path d="M15 10h2v4h-2z" />
                <path d="M6 21h12" />
              </svg>
            </div>
            <span className="text-[19px] font-bold tracking-[-0.02em] text-[#111827]">
              PayNest POS
            </span>
          </div>

          {!forgotMode ? (
            <>
              {/* Heading */}
              <div className="mb-7">
                <h1 className="text-[24px] font-bold tracking-[-0.02em] text-[#111827]">
                  Welcome back
                </h1>
                <p className="text-[14px] text-[#4B5563] mt-1">
                  Sign in to manage your counter, inventory, and daily sales.
                </p>
              </div>

              {error && (
                <div className="mb-5 px-3.5 py-2.5 rounded-[10px] bg-[#FEF2F2] border border-[#FECACA] text-[#EF4444] text-[13px] font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email Input */}
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-[13px] font-medium text-[#111827] mb-1.5"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[1.75]" />
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full h-11 pl-10 pr-4 text-[14px] bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10 transition-all"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-[13px] font-medium text-[#111827] mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none stroke-[1.75]" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full h-11 pl-10 pr-11 text-[14px] bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#9CA3AF] hover:text-[#4B5563]"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4 stroke-[1.75]" />
                      ) : (
                        <Eye className="w-4 h-4 stroke-[1.75]" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember Me + Forgot Password */}
                <div className="flex items-center justify-between gap-4 pt-0.5">
                  <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded-[4px] border-[#D1D5DB] text-[#4F46E5] focus:ring-[#4F46E5] accent-[#4F46E5]"
                    />
                    <span className="text-[13.5px] text-[#4B5563]">Remember me</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(true);
                      setResetSent(false);
                    }}
                    className="text-[13.5px] font-medium text-[#4F46E5] hover:text-[#4338CA] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Primary Sign In Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[14.5px] font-semibold transition-colors shadow-xs"
                >
                  Sign In
                </button>
              </form>
            </>
          ) : (
            <div className="space-y-5">
              <button
                type="button"
                onClick={() => setForgotMode(false)}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#4B5563] hover:text-[#111827]"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </button>

              <div>
                <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#111827]">
                  Reset password
                </h1>
                <p className="text-[13.5px] text-[#4B5563] mt-1">
                  Enter your store email to receive a password reset link.
                </p>
              </div>

              {resetSent ? (
                <div className="p-4 rounded-[10px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-[13.5px] flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                  <span>
                    Password reset instructions sent to{' '}
                    <span className="font-semibold">{resetEmail}</span>.
                  </span>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-medium text-[#111827] mb-1.5">
                      Email address
                    </label>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full h-11 px-3.5 text-[14px] bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] focus:outline-none focus:bg-white focus:border-[#4F46E5]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full h-11 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[14px] font-semibold transition-colors"
                  >
                    Send Reset Link
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Side: Soft Indigo Illustration Panel */}
      <div className="hidden lg:flex flex-col items-center justify-center p-12 xl:p-16 bg-[#EEF2FF] border-l border-[#E0E7FF]">
        <div className="max-w-[460px] w-full flex flex-col items-center text-center">
          {/* Minimal Flat Vector POS / Cash Register Illustration */}
          <div className="w-full max-w-[400px] mb-10">
            <svg
              viewBox="0 0 420 340"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-auto"
              role="img"
              aria-label="Minimal POS cash register illustration"
            >
              {/* Subtle soft backdrop circle */}
              <circle cx="210" cy="170" r="142" fill="#E0E7FF" opacity="0.65" />

              {/* Desk surface line */}
              <rect x="44" y="286" width="332" height="6" rx="3" fill="#C7D2FE" />

              {/* Cash Drawer Base */}
              <rect
                x="78"
                y="234"
                width="264"
                height="52"
                rx="10"
                fill="#FFFFFF"
                stroke="#4F46E5"
                strokeWidth="2.5"
              />
              {/* Cash Drawer Handle & Lock */}
              <rect x="172" y="255" width="76" height="10" rx="5" fill="#EEF2FF" stroke="#4F46E5" strokeWidth="2" />
              <circle cx="102" cy="260" r="4" fill="#10B981" />

              {/* POS Terminal Stand */}
              <path
                d="M178 194 L242 194 L252 234 L168 234 Z"
                fill="#C7D2FE"
                stroke="#4F46E5"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />

              {/* Main POS Display Screen */}
              <rect
                x="88"
                y="74"
                width="210"
                height="128"
                rx="14"
                fill="#FFFFFF"
                stroke="#4F46E5"
                strokeWidth="2.5"
              />
              {/* Screen Inner Viewport */}
              <rect x="102" y="88" width="182" height="100" rx="8" fill="#F6F8FB" />

              {/* Screen UI: Mini Product Tiles (Left) */}
              <rect x="112" y="98" width="44" height="34" rx="6" fill="#FFFFFF" stroke="#E6EAF0" strokeWidth="1.5" />
              <rect x="118" y="105" width="24" height="5" rx="2.5" fill="#4F46E5" />
              <rect x="118" y="115" width="30" height="4" rx="2" fill="#CBD5E1" />

              <rect x="164" y="98" width="44" height="34" rx="6" fill="#FFFFFF" stroke="#E6EAF0" strokeWidth="1.5" />
              <rect x="170" y="105" width="24" height="5" rx="2.5" fill="#10B981" />
              <rect x="170" y="115" width="30" height="4" rx="2" fill="#CBD5E1" />

              <rect x="112" y="140" width="44" height="34" rx="6" fill="#FFFFFF" stroke="#E6EAF0" strokeWidth="1.5" />
              <rect x="118" y="147" width="24" height="5" rx="2.5" fill="#F59E0B" />
              <rect x="118" y="157" width="30" height="4" rx="2" fill="#CBD5E1" />

              <rect x="164" y="140" width="44" height="34" rx="6" fill="#FFFFFF" stroke="#E6EAF0" strokeWidth="1.5" />
              <rect x="170" y="147" width="24" height="5" rx="2.5" fill="#4F46E5" />
              <rect x="170" y="157" width="30" height="4" rx="2" fill="#CBD5E1" />

              {/* Screen UI: Mini Cart Summary (Right) */}
              <rect x="218" y="98" width="56" height="76" rx="6" fill="#FFFFFF" stroke="#E6EAF0" strokeWidth="1.5" />
              <rect x="225" y="107" width="42" height="5" rx="2.5" fill="#111827" />
              <rect x="225" y="118" width="34" height="4" rx="2" fill="#CBD5E1" />
              <rect x="225" y="127" width="38" height="4" rx="2" fill="#CBD5E1" />
              <rect x="225" y="136" width="28" height="4" rx="2" fill="#CBD5E1" />
              <rect x="225" y="152" width="42" height="14" rx="5" fill="#4F46E5" />

              {/* Receipt Printer + Paper Tape on Right */}
              <rect
                x="284"
                y="162"
                width="64"
                height="72"
                rx="10"
                fill="#FFFFFF"
                stroke="#4F46E5"
                strokeWidth="2.5"
              />
              {/* Printed Receipt Paper */}
              <path
                d="M298 162 V102 C298 99 300 97 303 97 H329 C332 97 334 99 334 102 V162"
                fill="#FFFFFF"
                stroke="#4F46E5"
                strokeWidth="2.5"
              />
              <rect x="306" y="110" width="20" height="4" rx="2" fill="#4F46E5" />
              <rect x="306" y="121" width="20" height="3" rx="1.5" fill="#CBD5E1" />
              <rect x="306" y="130" width="16" height="3" rx="1.5" fill="#CBD5E1" />
              <rect x="306" y="139" width="20" height="3" rx="1.5" fill="#10B981" />

              {/* Printer Status Dot */}
              <circle cx="334" cy="180" r="3.5" fill="#10B981" />
              <rect x="298" y="196" width="36" height="5" rx="2.5" fill="#E0E7FF" />

              {/* Floating Payment Card Accent (Top Left) */}
              <rect
                x="44"
                y="112"
                width="68"
                height="44"
                rx="8"
                fill="#4F46E5"
              />
              <rect x="54" y="124" width="16" height="11" rx="2.5" fill="#C7D2FE" />
              <rect x="54" y="142" width="38" height="4" rx="2" fill="#FFFFFF" opacity="0.8" />
            </svg>
          </div>

          {/* Tagline */}
          <h2 className="text-[28px] font-bold tracking-[-0.02em] text-[#111827] text-balance">
            Sell smarter. Manage easier.
          </h2>
          <p className="text-[15px] text-[#4B5563] mt-2.5 leading-relaxed max-w-[360px]">
            Fast billing, live inventory tracking, and clear profit insights built for modern retail counters.
          </p>
        </div>
      </div>
    </div>
  );
};
