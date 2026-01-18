import { useState } from 'react';

// Format date to readable string
function formatDate(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const now = new Date();
    // Use Math.abs or specific date logic to prevent negative days from future dates
    const diffDays = Math.floor(Math.abs(now - date) / (1000 * 60 * 60 * 24));
    
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
  const match = fromString.match(/^([^<]+)</);
  if (match) return match[1].trim();
  return fromString.split('@')[0];
}

// Get initials for avatar
function getInitials(name) {
  return name
    .split(' ')
    .filter(word => word.length > 0) // Handle extra spaces in names
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
      <div 
        className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
        onClick={() => onReadMore?.(email.id)}
      >
        <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white text-xs font-medium flex-shrink-0`}>
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
      
      <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
        {email.subject || '(No Subject)'}
      </h3>
      
      <p className="text-sm text-gray-600 line-clamp-3 mb-3">
        {email.snippet || email.body?.slice(0, 200)}
      </p>
      
      {onReadMore && (
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <button 
            onClick={() => onReadMore(email.id)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            📖 Read full email
          </button>
        </div>
      )}
    </div>
  );
}

// Email List Container
export function EmailList({ emails, onReadMore, title }) {
  const [viewMode, setViewMode] = useState('cards');
  
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
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-700 flex items-center gap-2">
          📧 {title || `Found ${emails.length} email${emails.length !== 1 ? 's' : ''}`}
        </h3>
        <div className="flex gap-1">
          <button 
            onClick={() => setViewMode('cards')}
            className={`p-1.5 rounded ${viewMode === 'cards' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            title="Card view"
          >
            ▦
          </button>
          <button 
            onClick={() => setViewMode('compact')}
            className={`p-1.5 rounded ${viewMode === 'compact' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            title="List view"
          >
            ≡
          </button>
        </div>
      </div>
      
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

// Full Email View
export function FullEmailView({ email, onClose }) {
  if (!email) return null;
  
  const name = extractName(email.from);
  const initials = getInitials(name);
  const avatarColor = getAvatarColor(name);
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
      <div className="bg-gray-50 p-4 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-full ${avatarColor} flex items-center justify-center text-white font-medium`}>
              {initials}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{name}</h2>
              <p className="text-sm text-gray-500">{email.from}</p>
              {email.to && <p className="text-xs text-gray-400 mt-1">To: {email.to}</p>}
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm text-gray-500">{formatDate(email.date)}</span>
            {onClose && (
              <button onClick={onClose} className="ml-3 text-gray-400 hover:text-gray-600">✕</button>
            )}
          </div>
        </div>
        <h1 className="font-bold text-lg text-gray-900 mt-3">{email.subject || '(No Subject)'}</h1>
      </div>
      
      <div className="p-4">
        <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
          {email.body || email.snippet}
        </div>
      </div>
    </div>
  );
}

// Draft Confirmation Card
export function DraftCard({ draft }) {
  if (!draft) return null;
  
  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white">
          ✓
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-green-800">Draft Created!</h3>
          <p className="text-sm text-green-700 mt-1">To: {draft.to}</p>
          <p className="text-sm text-green-700">Subject: {draft.subject}</p>
          <p className="text-xs text-green-600 mt-2 italic">"{draft.bodyPreview}"</p>
          <p className="text-xs text-green-600 mt-2">📝 Find it in your Gmail Drafts folder</p>
        </div>
      </div>
    </div>
  );
}

export default EmailCard;