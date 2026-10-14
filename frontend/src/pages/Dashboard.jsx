import React from 'react';
import { Link } from 'react-router-dom';
import {
  BrainCircuit,
  Clock,
  ArrowRight,
  FileCheck2,
  BarChart3,
} from 'lucide-react';
import { Card, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export function Dashboard() {
  const quickActions = [
    {
      title: 'Run Crime Risk Prediction',
      description: 'Input state, district, and historical observation year to forecast the dominant next-year crime category.',
      link: '/predict',
      buttonText: 'Open Prediction Console',
      icon: BrainCircuit,
      variant: 'primary',
    },
    {
      title: 'Historical Crime Analytics',
      description: 'Explore multi-year crime patterns, category distributions, cross-location comparisons, and OLAP multidimensional cubes.',
      link: '/analytics',
      buttonText: 'Open Analytics Console',
      icon: BarChart3,
      variant: 'outline',
    },
    {
      title: 'Review Analysis Records',
      description: 'Browse, filter, and inspect your previously completed prediction records and confidence breakdowns.',
      link: '/history',
      buttonText: 'View History Log',
      icon: Clock,
      variant: 'outline',
    },
    {
      title: 'Analyst Profile & Credentials',
      description: 'Manage session credentials, view registered role authorization, and verify security status.',
      link: '/profile',
      buttonText: 'View Profile',
      icon: FileCheck2,
      variant: 'outline',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Welcome Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Crime Pattern Analytics & Forecasting
            </h1>
            <p className="max-w-2xl text-sm sm:text-base text-slate-600 leading-relaxed">
              CrimePulse analyzes historical district-wise crime data to identify patterns and predict
              the dominant crime category for the following year.
            </p>
          </div>
          <div className="shrink-0">
            <Link to="/predict">
              <Button size="lg" className="w-full sm:w-auto shadow-sm">
                <span>Start Analysis</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Available Modules</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card key={action.title} className="flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 mb-4">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base">{action.title}</CardTitle>
                  <CardDescription className="mt-2 text-xs leading-relaxed">
                    {action.description}
                  </CardDescription>
                </div>
                <div className="pt-6">
                  <Link to={action.link} className="block">
                    <Button variant={action.variant} size="md" className="w-full justify-between">
                      <span>{action.buttonText}</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
