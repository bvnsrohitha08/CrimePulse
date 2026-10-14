import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, UserPlus, Eye, EyeOff, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../hooks/useAuth';
import {
  validateName,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from '../utils/validation';

export function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (serverError) {
      setServerError('');
    }
  };

  const validateForm = () => {
    const errors = {};

    const nameValidation = validateName(formData.name);
    if (!nameValidation.isValid) {
      errors.name = nameValidation.message;
    }

    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) {
      errors.email = emailValidation.message;
    }

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      errors.password = passwordValidation.message;
    }

    const confirmValidation = validatePasswordConfirmation(
      formData.password,
      formData.confirmPassword
    );
    if (!confirmValidation.isValid) {
      errors.confirmPassword = confirmValidation.message;
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
      await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });

      // On successful registration, user receives token and goes to dashboard
      navigate('/dashboard', { replace: true });
    } catch (err) {
      let msg = err.message || 'Registration could not be completed. Please try again.';
      if (err.code === 'EMAIL_ALREADY_EXISTS' || err.status === 409) {
        msg = 'An account with this email address already exists. Please sign in instead.';
      } else if (err.code === 'NETWORK_ERROR' || err.status === 0) {
        msg = 'Unable to reach the server. Please check your network connection.';
      } else if (err.status >= 500) {
        msg = 'Registration service is temporarily unavailable. Please try again shortly.';
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
            Create Analyst Account
          </h1>
          <p className="text-xs text-slate-500">
            Register a new CrimePulse analytical workspace account.
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

        {/* Registration Card */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Analyst Profile Details</CardTitle>
            <CardDescription>Enter required account details to register</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name field */}
              <div className="space-y-1.5">
                <label htmlFor="register-name" className="text-xs font-semibold text-slate-700">
                  Full Name
                </label>
                <Input
                  id="register-name"
                  name="name"
                  autoComplete="name"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  placeholder="e.g. Maya Sharma"
                  className={fieldErrors.name ? 'border-rose-400 focus-visible:ring-rose-500' : ''}
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? 'register-name-error' : undefined}
                />
                {fieldErrors.name && (
                  <p id="register-name-error" className="text-[11px] font-medium text-rose-600">
                    {fieldErrors.name}
                  </p>
                )}
              </div>

              {/* Email field */}
              <div className="space-y-1.5">
                <label htmlFor="register-email" className="text-xs font-semibold text-slate-700">
                  Email Address
                </label>
                <Input
                  id="register-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  placeholder="analyst@crimepulse.org"
                  className={fieldErrors.email ? 'border-rose-400 focus-visible:ring-rose-500' : ''}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
                />
                {fieldErrors.email && (
                  <p id="register-email-error" className="text-[11px] font-medium text-rose-600">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="register-password" className="text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <span className="text-[11px] text-slate-400">Min 8 chars, max 72 bytes</span>
                </div>
                <div className="relative">
                  <Input
                    id="register-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    placeholder="Create a strong password"
                    className={`pr-10 ${fieldErrors.password ? 'border-rose-400 focus-visible:ring-rose-500' : ''}`}
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? 'register-password-error' : undefined}
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
                  <p id="register-password-error" className="text-[11px] font-medium text-rose-600">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              {/* Confirm password field */}
              <div className="space-y-1.5">
                <label htmlFor="register-confirm-password" className="text-xs font-semibold text-slate-700">
                  Confirm Password
                </label>
                <div className="relative">
                  <Input
                    id="register-confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    placeholder="Re-enter your password"
                    className={`pr-10 ${fieldErrors.confirmPassword ? 'border-rose-400 focus-visible:ring-rose-500' : ''}`}
                    aria-invalid={Boolean(fieldErrors.confirmPassword)}
                    aria-describedby={fieldErrors.confirmPassword ? 'register-confirm-password-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:text-slate-800"
                    aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p id="register-confirm-password-error" className="text-[11px] font-medium text-rose-600">
                    {fieldErrors.confirmPassword}
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
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    <span>Create Account</span>
                  </>
                )}
              </Button>

              <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
                Already have an analyst account?{' '}
                <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700 transition-colors">
                  Sign in here
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
