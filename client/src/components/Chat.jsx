import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { EmailList, FullEmailView, DraftCard } from './EmailCard';

// Tool Activity Indicator Component
function ToolIndicator({ toolCall, toolResult }) {
  const toolIcons = {
    searchEmails: '🔍',
    readEmail: '📧',
    draftReply: '✍️',
    getCalendarEvents: '📅',
    createCalendarEvent: '📆'
  };
  
  const toolLabels = {
    searchEmails: 'Searching emails',
    readEmail: 'Reading email',
    draftReply: 'Creating draft',
    getCalendarEvents: 'Checking calendar',
    createCalendarEvent: 'Creating event'
  };

  if (toolResult) {
    const successMessages = {
      searchEmails: `Found ${toolResult.emailCount || 0} email(s)`,
      readEmail: 'Email loaded',
      draftReply: 'Draft created',
      getCalendarEvents: `Found ${toolResult.eventCount || 0} event(s)`,
      createCalendarEvent: 'Event created'
    };
    
    return (
      <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg w-fit mb-2">
        <span>✓</span>
        <span>{successMessages[toolResult.name] || 'Done'}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg w-fit mb-2 animate-pulse">
      <span>{toolIcons[toolCall?.name] || '⚙️'}</span>
      <span>{toolLabels[toolCall?.name] || 'Processing'}...</span>
    </div>
  );
}

// Simple Markdown-like text formatter
function FormattedText({ text }) {
  if (!text) return null;
  
  // Split into lines and process
  const lines = text.split('\n');
  
  return (
    <div className="space-y-2">
      {lines.map((line, idx) => {
        // Headers
        if (line.startsWith('### ')) {
          return <h4 key={idx} className="font-semibold text-gray-900 mt-2">{line.slice(4)}</h4>;
        }
        if (line.startsWith('## ')) {
          return <h3 key={idx} className="font-bold text-gray-900 mt-3">{line.slice(3)}</h3>;
        }
        if (line.startsWith('# ')) {
          return <h2 key={idx} className="font-bold text-lg text-gray-900 mt-3">{line.slice(2)}</h2>;
        }
        
        // Bullet points
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={idx} className="flex gap-2 ml-2">
              <span className="text-gray-400">•</span>
              <span>{formatInlineText(line.slice(2))}</span>
            </div>
          );
        }
        
        // Numbered lists
        const numberedMatch = line.match(/^(\d+)\.\s(.+)/);
        if (numberedMatch) {
          return (
            <div key={idx} className="flex gap-2 ml-2">
              <span className="text-gray-500 font-medium">{numberedMatch[1]}.</span>
              <span>{formatInlineText(numberedMatch[2])}</span>
            </div>
          );
        }
        
        // Empty lines
        if (line.trim() === '') {
          return <div key={idx} className="h-2" />;
        }
        
        // Regular paragraph
        return <p key={idx}>{formatInlineText(line)}</p>;
      })}
    </div>
  );
}

// Format inline text (bold, italic, code)
function formatInlineText(text) {
  // Simple bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function Chat() {
  const { user, logout } = useAuth();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentTool, setCurrentTool] = useState(null);
  const [toolResult, setToolResult] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages, currentTool]);

  // Handle "Read More" click on email cards
  const handleReadEmail = (emailId) => {
    setInput(`Read the full content of email with ID: ${emailId}`);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsTyping(true);
    setCurrentTool(null);
    setToolResult(null);

    const history = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    try {
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: currentInput, history }),
      });

      if (response.status === 401) {
        const data = await response.json();
        if (data.needsReauth) {
          alert('Session expired. Please login again.');
          logout();
          return;
        }
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = { role: 'model', text: '', emails: null, email: null, draft: null };
      let hasAddedMessage = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') {
              setCurrentTool(null);
              setToolResult(null);
              continue;
            }

            try {
              const data = JSON.parse(dataStr);
              
              if (data.type === 'tool_call') {
                setCurrentTool(data.toolCall);
                setToolResult(null);
              }
              
              if (data.type === 'tool_result') {
                setToolResult(data.toolResult);
                
                // Store data for rendering
                if (data.toolResult.emails) {
                  assistantMessage.emails = data.toolResult.emails;
                }
                if (data.toolResult.email) {
                  assistantMessage.email = data.toolResult.email;
                }
                if (data.toolResult.draft) {
                  assistantMessage.draft = data.toolResult.draft;
                }
              }
              
              if (data.type === 'text' && data.text) {
                setCurrentTool(null);
                setToolResult(null);
                assistantMessage.text = data.text;
                
                if (!hasAddedMessage) {
                  setMessages(prev => [...prev, { ...assistantMessage }]);
                  hasAddedMessage = true;
                } else {
                  setMessages(prev => {
                    const newMsgs = [...prev];
                    newMsgs[newMsgs.length - 1] = { ...assistantMessage };
                    return newMsgs;
                  });
                }
              }
              
              if (data.type === 'error') {
                console.error('Stream error:', data.error);
                assistantMessage.text = `Sorry, an error occurred: ${data.error}`;
                if (!hasAddedMessage) {
                  setMessages(prev => [...prev, { ...assistantMessage }]);
                }
              }
            } catch (e) {
              console.error("Error parsing stream", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { 
        role: 'model', 
        text: 'Sorry, I encountered a connection error. Please try again.' 
      }]);
    } finally {
      setIsTyping(false);
      setCurrentTool(null);
      setToolResult(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm p-4 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-xl text-blue-600">Gemini Orchestrator</h1>
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
            📧 Gmail
          </span>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
            📅 Calendar
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden md:block">{user?.email}</span>
          <button onClick={logout} className="text-sm text-red-500 hover:text-red-700 font-medium">
            Logout
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="text-6xl mb-4">🤖</div>
            <p className="text-xl font-medium text-gray-600">Hi {user?.given_name || 'there'}!</p>
            <p className="text-gray-400 mb-6">I can help with your emails and calendar</p>
            
            <div className="grid gap-2 text-sm max-w-lg">
              <div 
                className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 hover:border-blue-200 cursor-pointer transition-all"
                onClick={() => setInput("Do I have any unread emails?")}
              >
                💡 "Do I have any unread emails?"
              </div>
              <div 
                className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 hover:border-blue-200 cursor-pointer transition-all"
                onClick={() => setInput("What's on my calendar this week?")}
              >
                💡 "What's on my calendar this week?"
              </div>
              <div 
                className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 hover:border-blue-200 cursor-pointer transition-all"
                onClick={() => setInput("Search for emails about invoices")}
              >
                💡 "Search for emails about invoices"
              </div>
              <div 
                className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 hover:border-blue-200 cursor-pointer transition-all"
                onClick={() => setInput("Schedule a meeting tomorrow at 2pm")}
              >
                💡 "Schedule a meeting tomorrow at 2pm"
              </div>
            </div>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className="space-y-3">
            {/* Message bubble */}
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-4 ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-white text-gray-800 shadow-sm rounded-bl-none border border-gray-100'
              }`}>
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                ) : (
                  <FormattedText text={msg.text} />
                )}
              </div>
            </div>
            
            {/* Email list cards */}
            {msg.emails && msg.emails.length > 0 && (
              <div className="ml-4">
                <EmailList emails={msg.emails} onReadMore={handleReadEmail} />
              </div>
            )}
            
            {/* Full email view */}
            {msg.email && (
              <div className="ml-4">
                <FullEmailView email={msg.email} />
              </div>
            )}
            
            {/* Draft confirmation */}
            {msg.draft && (
              <div className="ml-4">
                <DraftCard draft={msg.draft} />
              </div>
            )}
          </div>
        ))}
        
        {/* Tool activity indicators */}
        {currentTool && (
          <div className="flex justify-start">
            <ToolIndicator toolCall={currentTool} toolResult={toolResult} />
          </div>
        )}
        
        {isTyping && !currentTool && (
          <div className="flex justify-start">
            <div className="text-xs text-gray-400 bg-white px-3 py-2 rounded-lg shadow-sm">
              Gemini is thinking... 
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about emails, calendar, or schedule meetings..."
            className="flex-1 p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isTyping}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}