import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { ApiError } from '../../api/client';

interface LoginViewProps {
  onSignIn: (email: string, password: string) => Promise<void>;
}

export function LoginView({ onSignIn }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onSignIn(email.trim(), password);
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : 'Unable to sign in. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB] grid grid-cols-1 lg:grid-cols-2">
      <div className="flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-[440px] bg-white border border-[#E6EAF0] rounded-[12px] p-8 sm:p-10 shadow-[0_1px_2px_rgba(17,24,39,0.03),0_8px_24px_rgba(17,24,39,0.04)]">
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
                <path d="M4 10h16" />
                <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
                <path d="M12 10V5" />
                <path d="M9 5h6" />
                <path d="M9 14h6" />
              </svg>
            </div>
            <span className="text-[19px] font-bold tracking-[-0.02em] text-[#111827]">
              PayNest Restaurant
            </span>
          </div>

          <div className="mb-7">
            <h1 className="text-[24px] font-bold tracking-[-0.02em] text-[#111827]">
              Staff sign in
            </h1>
            <p className="text-[14px] text-[#4B5563] mt-1">
              Sign in to manage tables, orders, the kitchen and billing.
            </p>
          </div>

          {error && (
            <div className="mb-5 px-3.5 py-2.5 rounded-[10px] bg-[#FEF2F2] border border-[#FECACA] text-[#EF4444] text-[13px] font-medium">
              {error}
            </div>
          )}

          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
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
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-11 pl-10 pr-4 text-[14px] bg-[#F6F8FB] border border-[#E6EAF0] rounded-[10px] text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:bg-white focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/10 transition-all"
                />
              </div>
            </div>

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
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
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

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] text-white text-[14.5px] font-semibold transition-colors shadow-xs disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>

      <div className="hidden lg:flex flex-col items-center justify-center p-12 xl:p-16 bg-[#EEF2FF] border-l border-[#E0E7FF]">
        <div className="max-w-[460px] w-full flex flex-col items-center text-center">
          <div className="w-full max-w-[400px] mb-10">
            <svg
              viewBox="0 0 420 340"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-auto"
              role="img"
              aria-label="Restaurant table with a meal and QR code"
            >
              <circle cx="210" cy="170" r="142" fill="#E0E7FF" opacity="0.65" />
              <rect x="44" y="286" width="332" height="6" rx="3" fill="#C7D2FE" />

              <path d="M210 272 V226" stroke="#4F46E5" strokeWidth="10" strokeLinecap="round" />
              <ellipse cx="210" cy="274" rx="72" ry="10" fill="#C7D2FE" />
              <rect x="156" y="212" width="108" height="16" rx="8" fill="#4F46E5" />
              <path d="M168 228 L182 272" stroke="#C7D2FE" strokeWidth="8" strokeLinecap="round" />
              <path d="M252 228 L238 272" stroke="#C7D2FE" strokeWidth="8" strokeLinecap="round" />

              <circle cx="198" cy="180" r="60" fill="#FFFFFF" stroke="#4F46E5" strokeWidth="3" />
              <circle cx="198" cy="180" r="45" fill="#F6F8FB" stroke="#E6EAF0" strokeWidth="2" />
              <path d="M166 184c8-18 24-27 42-24 9 1 17 6 23 13" stroke="#10B981" strokeWidth="6" strokeLinecap="round" />
              <path d="M172 196c14 8 34 8 50-2" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" />
              <circle cx="212" cy="166" r="8" fill="#EF4444" opacity="0.85" />

              <rect
                x="276"
                y="112"
                width="86"
                height="86"
                rx="12"
                fill="#FFFFFF"
                stroke="#4F46E5"
                strokeWidth="3"
              />
              <rect x="290" y="126" width="20" height="20" rx="3" fill="#4F46E5" />
              <rect x="316" y="126" width="20" height="20" rx="3" fill="#4F46E5" />
              <rect x="342" y="126" width="8" height="20" rx="2" fill="#C7D2FE" />
              <rect x="290" y="152" width="20" height="20" rx="3" fill="#4F46E5" />
              <rect x="342" y="152" width="20" height="20" rx="3" fill="#4F46E5" />
              <rect x="316" y="178" width="20" height="8" rx="2" fill="#C7D2FE" />
              <rect x="342" y="178" width="20" height="8" rx="2" fill="#C7D2FE" />

              <rect x="46" y="116" width="76" height="52" rx="10" fill="#4F46E5" />
              <path d="M62 142h44" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" />
              <path d="M62 154h30" stroke="#C7D2FE" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>

          <h2 className="text-[28px] font-bold tracking-[-0.02em] text-[#111827] text-balance">
            One view of the whole restaurant
          </h2>
          <p className="text-[15px] text-[#4B5563] mt-2.5 leading-relaxed max-w-[360px]">
            Tables, guest orders, kitchen tickets and bills stay in sync for every role.
          </p>
        </div>
      </div>
    </div>
  );
}
