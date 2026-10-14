import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BrainCircuit,
  Clock,
  User,
  LogIn,
  UserPlus,
  ShieldAlert,
  X,
  LogOut,
  BarChart3,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useAuth } from '../hooks/useAuth';

export function Sidebar({ isOpen, onClose }) {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const mainNavItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Crime Prediction', path: '/predict', icon: BrainCircuit },
    { name: 'Crime Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Analysis History', path: '/history', icon: Clock },
    { name: 'Analyst Profile', path: '/profile', icon: User },
  ];

  const authNavItems = [
    { name: 'Login Portal', path: '/login', icon: LogIn },
    { name: 'Register Account', path: '/register', icon: UserPlus },
  ];

  const handleLogout = () => {
    logout();
    onClose?.();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors select-none',
      isActive
        ? 'bg-brand-50 text-brand-700 font-semibold'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          role="presentation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out md:static md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile Header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-200 md:hidden">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <ShieldAlert className="h-5 w-5 text-brand-600" />
            <span>CrimePulse</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex flex-1 flex-col justify-between overflow-y-auto px-4 py-6">
          <div className="space-y-6">
            <div>
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Core Analytics
              </p>
              <nav className="mt-2 space-y-1">
                {mainNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={navLinkClass}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.name}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            <div>
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Account & Access
              </p>
              {isAuthenticated ? (
                <div className="mt-2 space-y-2 px-1">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <div className="text-xs font-semibold text-slate-900 truncate">{user?.name}</div>
                    <div className="text-[11px] text-slate-500 truncate">{user?.email}</div>
                    <div className="mt-1.5">
                      <span className="inline-block rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-800">
                        {user?.role || 'CUSTOMER'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                  >
                    <LogOut className="h-4 w-4 text-slate-400" />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <nav className="mt-2 space-y-1">
                  {authNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={onClose}
                        className={navLinkClass}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.name}</span>
                      </NavLink>
                    );
                  })}
                </nav>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
