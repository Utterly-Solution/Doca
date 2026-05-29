'use client';

import Link from 'next/link';
import {
  FileText,
  Search,
  MessageSquare,
  BookOpen,
  Upload,
  Activity,
  Clock,
  TrendingUp,
} from 'lucide-react';

const metrics = [
  { label: 'Total Documents', value: '24', icon: FileText, color: 'bg-blue-50 text-blue-600' },
  { label: 'Analyses Run', value: '18', icon: Search, color: 'bg-green-50 text-green-600' },
  { label: 'Active Sessions', value: '5', icon: MessageSquare, color: 'bg-purple-50 text-purple-600' },
  { label: 'KB Entries', value: '12', icon: BookOpen, color: 'bg-orange-50 text-orange-600' },
];

const recentActivity = [
  { text: 'Care plan uploaded: Johnson_CarePlan_2026.pdf', time: '2 hours ago', icon: Upload },
  { text: 'Analysis completed for Patient Assessment.docx', time: '3 hours ago', icon: Search },
  { text: 'Chat session with Medication_Schedule.pdf', time: '5 hours ago', icon: MessageSquare },
  { text: 'Document edited: Incident_Report_May.docx', time: '1 day ago', icon: FileText },
  { text: 'New Q&A pair added to Knowledge Base', time: '1 day ago', icon: BookOpen },
];

const quickActions = [
  { label: 'Upload Document', description: 'Analyze a new document', href: '/analyzer', icon: Upload, color: 'bg-blue-600 hover:bg-blue-700' },
  { label: 'Open Chatbot', description: 'Chat with your documents', href: '/chatbot', icon: MessageSquare, color: 'bg-purple-600 hover:bg-purple-700' },
  { label: 'Knowledge Base', description: 'Manage Q&A pairs', href: '/knowledge-base', icon: BookOpen, color: 'bg-green-600 hover:bg-green-700' },
];

export default function DashboardPage() {
  return (
    <div className="p-4 sm:p-6">
      {/* Welcome */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Welcome back, Sarah</h1>
        <p className="text-gray-500 mt-1">Here&apos;s what&apos;s happening with your documents today.</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {metrics.map((metric) => {
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
              <div className="flex items-center gap-1 mt-3 text-xs text-green-600">
                <TrendingUp className="w-3 h-3" />
                <span>+12% from last week</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {recentActivity.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">{item.text}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {item.time}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
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
