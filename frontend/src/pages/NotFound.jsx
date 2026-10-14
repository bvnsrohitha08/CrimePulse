import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';

export function NotFound() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 px-4 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 mb-4 border border-slate-200">
        <ShieldAlert className="h-6 w-6 text-brand-600" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">404 — Page Not Found</h1>
      <p className="mt-2 text-sm text-slate-500 max-w-sm">
        The requested CrimePulse view or route does not exist.
      </p>
      <div className="mt-6">
        <Link to="/dashboard">
          <Button variant="primary">
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Dashboard</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
