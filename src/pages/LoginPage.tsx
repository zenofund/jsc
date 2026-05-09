import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/button';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const success = await login(email, password);
    
    if (!success) {
      setError('Invalid email or password');
    }
    
    setLoading(false);
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
          <h2 className="text-card-foreground mb-3 sm:mb-4 text-center text-sm sm:text-base font-bold">Sign In to Your Account</h2>

          {error && (
            <div className="mb-3 p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg flex items-center gap-2 text-red-800 dark:text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs sm:text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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

            <Button
              type="submit"
              isLoading={loading}
              className="w-full"
            >
              Sign In
            </Button>
          </form>

          {/* Forgot Password Link */}
          <div className="mt-3 sm:mt-4 text-center">
            <Link
              to="/forgot-password"
              className="text-xs sm:text-sm text-primary hover:text-primary/80 transition-colors"
            >
              Forgot your password?
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-4 sm:mt-5">
          © {new Date().getFullYear()} Judicial Service Committee. All rights reserved.
        </p>
      </div>
    </div>
  );
}
