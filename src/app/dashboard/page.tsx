'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  Search,
  MessageSquare,
  Upload,
  Activity,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getDocuments, getSessions, getAuditLog } from '@/lib/store';
import { AuditLogEntry } from '@/lib/types';

const quickActions = [
  { label: 'Upload Document', description: 'Analyze a new document', href: '/analyzer', icon: Upload, color: 'bg-blue-600 hover:bg-blue-700' },
  { label: 'Open Chatbot', description: 'Chat with your documents', href: '/chatbot', icon: MessageSquare, color: 'bg-purple-600 hover:bg-purple-700' },
];

function getActionIcon(action: string) {
  if (action.includes('upload')) return Upload;
  if (action.includes('analy') || action.includes('summar')) return Search;
  if (action.includes('chat') || action.includes('edit')) return MessageSquare;
  return FileText;
}

function timeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [metrics, setMetrics] = useState({ documents: 0, analyses: 0, sessions: 0 });
  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[]>([]);

  const isAdmin = user?.role === 'Administrator';

  // Only admins can access the dashboard
  useEffect(() => {
    if (user && !isAdmin) {
      router.replace('/analyzer');
    }
  }, [user, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    const docs = getDocuments();
    const sessions = getSessions();
    const auditLog = getAuditLog();

    const analyzedCount = docs.filter((d) => d.analysis && d.analysis.length > 0).length;

    setMetrics({
      documents: docs.length,
      analyses: analyzedCount,
      sessions: sessions.length,
    });

    setRecentActivity(auditLog.slice(0, 8));
  }, [isAdmin]);

  if (!isAdmin) {
    return null;
  }

  const metricCards = [
    { label: 'Total Documents', value: String(metrics.documents), icon: FileText, color: 'bg-blue-50 text-blue-600' },
    { label: 'Analyses Run', value: String(metrics.analyses), icon: Search, color: 'bg-green-50 text-green-600' },
    { label: 'Chat Sessions', value: String(metrics.sessions), icon: MessageSquare, color: 'bg-purple-50 text-purple-600' },
  ];

  const firstName = user?.name?.split(' ')[0] || 'User';

  return (
    <div className="p-4 sm:p-6">
      {/* Welcome */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Welcome back, {firstName}</h1>
        <p className="text-gray-500 mt-1">Here&apos;s what&apos;s happening with your documents today.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Metric Cards + Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {metricCards.map((metric) => {
              const Icon = metric.icon;
              return (
                <div
                  key={metric.label}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">{metric.label}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${metric.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-500" />
              <h3 className="font-semibold text-gray-900">Recent Activity</h3>
            </div>
            {recentActivity.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">
                No activity yet. Upload a document to get started.
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentActivity.map((item) => {
                  const Icon = getActionIcon(item.action);
                  return (
                    <div key={item.id} className="px-5 py-3.5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 truncate">{item.details}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                        <Clock className="w-3 h-3" />
                        {timeAgo(item.timestamp)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 px-1">Quick Actions</h3>
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className={`flex items-center gap-3 p-4 rounded-xl text-white transition-colors ${action.color}`}
              >
                <Icon className="w-5 h-5" />
                <div>
                  <p className="font-medium text-sm">{action.label}</p>
                  <p className="text-xs text-white/70">{action.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
