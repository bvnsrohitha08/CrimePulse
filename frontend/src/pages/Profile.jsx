import React from 'react';
import { Shield, KeyRound, Clock, UserCheck, Calendar, Mail, Tag } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../hooks/useAuth';

export function Profile() {
  const { user } = useAuth();

  const formattedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Recently Registered';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="primary">Analyst Profile</Badge>
          <span className="text-xs text-slate-400">•</span>
          <span className="text-xs text-slate-500">Verified Database Session</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Account & Security Overview
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Review your analyst credentials, assigned system permissions, and active session properties.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Card */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Analyst Profile Information</CardTitle>
              <CardDescription>Verified account details stored in MongoDB Atlas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <UserCheck className="h-3 w-3 text-slate-400" />
                    Full Name
                  </span>
                  <div className="text-sm font-semibold text-slate-900">
                    {user?.name || 'Authenticated Analyst'}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Mail className="h-3 w-3 text-slate-400" />
                    Registered Email
                  </span>
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {user?.email || 'N/A'}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Tag className="h-3 w-3 text-slate-400" />
                    Authorization Role
                  </span>
                  <div>
                    <Badge variant="primary">{user?.role || 'CUSTOMER'}</Badge>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    Registration Date
                  </span>
                  <div className="text-sm font-semibold text-slate-900">
                    {formattedDate}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Security / System Info Card */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-600" />
                Security Standards
              </CardTitle>
              <CardDescription>Backend encryption & token policies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5 py-1.5 border-b border-slate-100">
                <KeyRound className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-800">Password Protection</div>
                  <div className="text-slate-500 text-[11px]">Bcrypt with 10 salt rounds</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 py-1.5 border-b border-slate-100">
                <Shield className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-800">JWT Token Expiry</div>
                  <div className="text-slate-500 text-[11px]">Explicit expiry (24h default)</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 py-1.5">
                <Clock className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-800">Ownership Scoping</div>
                  <div className="text-slate-500 text-[11px]">Strict database-level isolation</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
