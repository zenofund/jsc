import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import QRCode from 'qrcode';
import { Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { authAPI } from '../lib/api-client';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<'credentials' | 'totp' | 'totp-setup'>('credentials');
  const [totpCode, setTotpCode] = useState('');
  const [setup, setSetup] = useState<{ otpauth_url: string; secret: string; issuer?: string; account?: string } | null>(null);

  useEffect(() => {
    async function buildQr() {
      if (!setup?.otpauth_url) {
        setQrSrc(null);
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(setup.otpauth_url, {
          width: 200,
          margin: 1,
        });
        setQrSrc(dataUrl);
      } catch (err) {
        console.error('Failed to generate 2FA QR code:', err);
        setQrSrc(null);
      }
    }

    buildQr();
  }, [setup?.otpauth_url]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (stage === 'credentials') {
        const result = await login(email, password);
        if (result.status === 'success') {
          setLoading(false);
          return;
        }
        if (result.status === 'totp_required') {
          setStage('totp');
          setLoading(false);
          return;
        }
        if (result.status === 'totp_setup_required') {
          const setupData = await authAPI.setupTwoFactor(email, password);
          setSetup(setupData);
          setStage('totp-setup');
          setLoading(false);
          return;
        }
        setError(result.message || 'Invalid email or password');
        setLoading(false);
        return;
      }

      if (stage === 'totp') {
        const result = await login(email, password, totpCode);
        if (result.status === 'success') {
          setLoading(false);
          return;
        }
        if (result.status === 'totp_setup_required') {
          const setupData = await authAPI.setupTwoFactor(email, password);
          setSetup(setupData);
          setStage('totp-setup');
          setLoading(false);
          return;
        }
        setError(result.message || 'Invalid verification code');
        setLoading(false);
        return;
      }

      if (stage === 'totp-setup') {
        if (!totpCode || totpCode.trim().length < 6) {
          setError('Enter the 6-digit verification code from your authenticator app');
          setLoading(false);
          return;
        }
        await authAPI.enableTwoFactor(email, password, totpCode);
        const result = await login(email, password, totpCode);
        if (result.status !== 'success') {
          setError(result.message || 'Login failed');
        }
        setLoading(false);
        return;
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-amber-50/30 to-green-50/50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-5 sm:mb-6">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-green-600 dark:bg-green-700 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
            <Lock className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </div>
          <h1 className="text-foreground font-bold mb-1 text-base sm:text-lg">Judicial Service Committee</h1>
          <p className="text-muted-foreground text-xs sm:text-sm">Payroll Management System</p>
        </div>

        {/* Login Card */}
        <div className="bg-card border border-border rounded-lg shadow-lg p-5 sm:p-6">
          <h2 className="text-card-foreground mb-3 sm:mb-4 text-center text-sm sm:text-base font-bold">
            {stage === 'credentials' && 'Sign In to Your Account'}
            {stage === 'totp' && 'Two-Factor Verification'}
            {stage === 'totp-setup' && 'Set Up Two-Factor Authentication'}
          </h2>

          {error && (
            <div className="mb-3 p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg flex items-center gap-2 text-red-800 dark:text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Notice removed per user request - location prompt appears only when requested by the browser */}
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={stage !== 'credentials'}
                  className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 text-sm sm:text-base bg-input-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
                  placeholder="Email Address"
                  required
                />
              </div>
            </div>

            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={stage !== 'credentials'}
                  className="w-full pl-9 sm:pl-10 pr-10 sm:pr-12 py-2 text-sm sm:text-base bg-input-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground"
                  placeholder="Password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {stage !== 'credentials' && (
              <div>
                <label className="block text-xs sm:text-sm text-muted-foreground mb-1">
                  Verification Code
                </label>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full px-3 py-2 text-sm sm:text-base bg-input-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground tracking-widest text-center"
                  placeholder="123456"
                  required
                />
              </div>
            )}

            {stage === 'totp-setup' && setup?.otpauth_url && (
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-40 h-40 rounded-md border border-border bg-white grid place-items-center">
                    {qrSrc ? (
                      <img
                        alt="2FA QR Code"
                        className="w-36 h-36"
                        src={qrSrc}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">Generating QR code...</span>
                    )}
                  </div>
                  <div className="w-full">
                    <div className="text-xs text-muted-foreground mb-1">Manual setup key</div>
                    <div className="text-sm font-mono break-all text-card-foreground">{setup.secret}</div>
                  </div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              isLoading={loading}
              className="w-full"
            >
              {stage === 'credentials' && 'Sign In'}
              {stage === 'totp' && 'Verify & Sign In'}
              {stage === 'totp-setup' && 'Enable 2FA & Sign In'}
            </Button>

            {stage !== 'credentials' && (
              <button
                type="button"
                onClick={() => {
                  setStage('credentials');
                  setTotpCode('');
                  setSetup(null);
                  setError('');
                }}
                className="w-full text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Use a different account
              </button>
            )}
          </form>

          {stage === 'credentials' && (
            <div className="mt-3 sm:mt-4 text-center">
              <Link
                to="/forgot-password"
                className="text-xs sm:text-sm text-primary hover:text-primary/80 transition-colors"
              >
                Forgot your password?
              </Link>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-500 mt-4 sm:mt-5">
          © {new Date().getFullYear()} Judicial Service Committee. All rights reserved.
        </p>
      </div>
    </div>
  );
}
