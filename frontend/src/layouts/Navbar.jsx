import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, ShieldAlert, User, LogOut, LogIn } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';

export function Navbar({ onToggleSidebar }) {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Menu className="h-5 w-5" />
        </button>

        <Link to="/dashboard" className="flex items-center gap-2.5 font-bold tracking-tight text-slate-900">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold leading-none text-slate-900">CrimePulse</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Analytics Gateway</span>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {/* User Session / Auth Controls */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Link
                to="/profile"
                aria-label="Analyst profile"
                className="flex items-center gap-2 rounded-lg p-1.5 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-700 border border-brand-200 font-semibold text-xs">
                  {user?.name ? user.name.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-semibold leading-none text-slate-900">{user?.name}</span>
                  <span className="text-[10px] text-slate-500 leading-tight">{user?.role || 'CUSTOMER'}</span>
                </div>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                aria-label="Sign out"
                className="text-slate-500 hover:text-rose-600 hover:bg-rose-50"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Sign Out</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="outline" size="sm">
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Sign In</span>
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
