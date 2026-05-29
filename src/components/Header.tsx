'use client';

import { usePathname } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

const pageNames: Record<string, { title: string; description: string }> = {
  '/dashboard': { title: 'Dashboard', description: 'AI Command Center' },
  '/documents': { title: 'Document Library', description: 'Manage uploaded documents' },
  '/analyzer': { title: 'Document Analyzer', description: 'Upload and analyze documents' },
  '/chatbot': { title: 'Chatbot', description: 'Chat with your documents' },
  '/knowledge-base': { title: 'Knowledge Base', description: 'Manage Q&A pairs for AI training' },
};

export default function Header() {
  const pathname = usePathname();
  const page = pageNames[pathname] || { title: 'Doca', description: '' };

  return (
    <div>
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
        {/* Add left padding on mobile to avoid overlap with hamburger */}
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 pl-10 lg:pl-0">{page.title}</h2>
        {page.description && (
          <p className="text-xs sm:text-sm text-gray-500 pl-10 lg:pl-0">{page.description}</p>
        )}
      </div>
    </div>
  );
}
