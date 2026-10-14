import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, LogIn, Eye, EyeOff, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../hooks/useAuth';
import { validateEmail, validatePassword } from '../utils/validation';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const destination = location.state?.from?.pathname || '/dashboard';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field-specific error as user types
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (serverError) {
      setServerError('');
    }
  };

  const validateForm = () => {
    const errors = {};
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) {
      errors.email = emailValidation.message;
    }

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      errors.password = passwordValidation.message;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setServerError('');

    try {
      await login({
        email: formData.email.trim(),
        password: formData.password,
      });

      // Navigate to destination on success
      navigate(destination, { replace: true });
    } catch (err) {
      // Map error safely without exposing stack traces
      let msg = err.message || 'Authentication failed. Please verify your credentials.';
      if (err.code === 'INVALID_CREDENTIALS' || err.status === 401) {
        msg = 'Invalid email or password.';
      } else if (err.code === 'NETWORK_ERROR' || err.status === 0) {
        msg = 'Unable to reach the server. Please check your network connection.';
      } else if (err.status >= 500) {
        msg = 'Authentication service is temporarily unavailable. Please try again shortly.';
      }
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <Link to="/dashboard" className="flex items-center gap-2 font-bold text-slate-900 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm group-hover:bg-brand-700 transition-colors">
              <ShieldAlert className="h-6 w-6" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Sign In to CrimePulse
          </h1>
          <p className="text-xs text-slate-500">
            Access protected historical crime pattern forecasting and analysis records.
          </p>
        </div>

        {/* Server Error Alert Banner */}
        {serverError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-xs text-rose-800 flex items-start gap-2.5 shadow-sm"
          >
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{serverError}</div>
          </div>
        )}

        {/* Login Card */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Analyst Credentials</CardTitle>
            <CardDescription>Enter your registered email and password to proceed</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email field */}
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="text-xs font-semibold text-slate-700">
                  Email Address
                </label>
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  placeholder="analyst@crimepulse.org"
                  className={fieldErrors.email ? 'border-rose-400 focus-visible:ring-rose-500' : ''}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                />
                {fieldErrors.email && (
                  <p id="login-email-error" className="text-[11px] font-medium text-rose-600">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <span className="text-[11px] text-slate-400">Min 8 characters</span>
                </div>
                <div className="relative">
                  <Input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    placeholder="Enter your password"
                    className={`pr-10 ${fieldErrors.password ? 'border-rose-400 focus-visible:ring-rose-500' : ''}`}
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:text-slate-800"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p id="login-password-error" className="text-[11px] font-medium text-rose-600">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                variant="primary"
                className="w-full mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    <span>Sign In</span>
                  </>
                )}
              </Button>

              <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
                Don't have an analyst account?{' '}
                <Link
                  to="/register"
                  state={location.state}
                  className="font-semibold text-brand-600 hover:text-brand-700 transition-colors"
                >
                  Register here
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Back to Dashboard */}
        <div className="text-center">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
