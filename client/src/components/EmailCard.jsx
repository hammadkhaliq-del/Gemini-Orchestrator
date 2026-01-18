import { useState } from 'react';

// Format date to readable string
function formatDate(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  } catch {
    return dateString;
  }
}

// Extract name from email address
function extractName(fromString) {
  if (!fromString) return 'Unknown';
  // Handle "Name <email@example.com>" format
  const match = fromString.match(/^([^<]+)</);
  if (match) return match[1].trim();
  // Handle plain email
  return fromString.split('@')[0];
}

// Get initials for avatar
function getInitials(name) {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Generate consistent color from name
function getAvatarColor(name) {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
    'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
    'bg-orange-500', 'bg-red-500', 'bg-cyan-500'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Single Email Card
export function EmailCard({ email, onReadMore, compact = false }) {
  const name = extractName(email.from);
  const initials = getInitials(name);
  const avatarColor = getAvatarColor(name);
  
  if (compact) {
    return (
      <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
           onClick={() => onReadMore?.(email.id)}>
        <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white text-xs font-medium`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm text-gray-900 truncate">{name}</span>
            <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(email.date)}</span>
          </div>
          <p className="text-sm text-gray-600 truncate">{email.subject}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-white font-medium flex-shrink-0`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-gray-900 truncate">{name}</span>
            <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(email.date)}</span>
          </div>
          <p className="text-xs text-gray-500 truncate">{email.from}</p>
        </div>
      </div>
      
      {/* Subject */}
      <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
        {email.subject || '(No Subject)'}
      </h3>
      
      {/* Snippet/Body Preview */}
      <p className="text-sm text-gray-600 line-clamp-3 mb-3">
        {email.snippet || email.body?.slice(0, 200)}
      </p>
      
      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        {onReadMore && (
          <button 
            onClick={() => onReadMore(email.id)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            <span>📖</span> Read full email
          </button>
        )}
        <span className="text-xs text-gray-400">•</span>
        <span className="text-xs text-gray-400">ID: {email.id?.slice(0, 8)}...</span>
      </div>
    </div>
  );
}

// Email List Container
export function EmailList({ emails, onReadMore, title }) {
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'compact'
  
  if (!emails || emails.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-6 text-center">
        <span className="text-4xl mb-2 block">📭</span>
        <p className="text-gray-500">No emails found</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-700 flex items-center gap-2">
          <span>📧</span>
          {title || `Found ${emails.length} email${emails.length !== 1 ? 's' : ''}`}
        </h3>
        <div className="flex gap-1">
          <button 
            onClick={() => setViewMode('cards')}
            className={`p-1.5 rounded ${viewMode === 'cards' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            title="Card view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button 
            onClick={() => setViewMode('compact')}
            className={`p-1.5 rounded ${viewMode === 'compact' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            title="List view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Email Grid/List */}
      {viewMode === 'cards' ? (
        <div className="grid gap-3 md:grid-cols-2">
          {emails.map((email, idx) => (
            <EmailCard key={email.id || idx} email={email} onReadMore={onReadMore} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {emails.map((email, idx) => (
            <EmailCard key={email.id || idx} email={email} onReadMore={onReadMore} compact />
          ))}
        </div>
      )}
    </div>
  );
}

// Full Email View (for when user clicks "Read More")
export function FullEmailView({ email, onClose }) {
  if (!email) return null;
  
  const name = extractName(email.from);
  const initials = getInitials(name);
  const avatarColor = getAvatarColor(name);
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 p-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-full ${avatarColor} flex items-center justify-center text-white font-medium`}>
              {initials}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{name}</h2>
              <p className="text-sm text-gray-500">{email.from}</p>
              {email.to && (
                <p className="text-xs text-gray-400 mt-1">To: {email.to}</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm text-gray-500">{formatDate(email.date)}</span>
            {onClose && (
              <button 
                onClick={onClose}
                className="ml-3 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <h1 className="font-bold text-lg text-gray-900 mt-3">
          {email.subject || '(No Subject)'}
        </h1>
      </div>
      
      {/* Body */}
      <div className="p-4">
        <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
          {email.body || email.snippet}
        </div>
      </div>
    </div>
  );
}