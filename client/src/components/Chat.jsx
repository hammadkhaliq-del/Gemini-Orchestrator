import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

// Tool Activity Indicator Component
function ToolIndicator({ toolCall, toolResult }) {
  const toolIcons = {
    searchEmails: '🔍',
    readEmail:  '📧'
  };
  
  const toolLabels = {
    searchEmails: 'Searching emails',
    readEmail: 'Reading email'
  };

  if (toolResult) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg w-fit mb-2">
        <span>✓</span>
        <span>
          {toolResult.name === 'searchEmails' 
            ? `Found ${toolResult.emailCount} email(s)` 
            : 'Email loaded'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg w-fit mb-2 animate-pulse">
      <span>{toolIcons[toolCall?. name] || '⚙️'}</span>
      <span>{toolLabels[toolCall?.name] || 'Processing'}...</span>
    </div>
  );
}

export default function Chat() {
  const { user, logout } = useAuth();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentTool, setCurrentTool] = useState(null);
  const [toolResult, setToolResult] = useState(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages, currentTool]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // 1. Add user message immediately
    const userMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    setCurrentTool(null);
    setToolResult(null);

    // 2. Prepare history for backend (map to Gemini format)
    const history = messages. map(m => ({
      role: m. role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    try {
      // 3. Start Request
      const response = await fetch('http://localhost:5000/api/chat', {
        method:  'POST',
        headers:  { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: userMessage. text, history }),
      });

      // Check for auth errors
      if (response.status === 401) {
        const data = await response.json();
        if (data.needsReauth) {
          alert('Session expired. Please login again.');
          logout();
          return;
        }
      }

      // 4. Handle Stream
      const reader = response.body. getReader();
      const decoder = new TextDecoder();
      let assistantMessage = { role: 'model', text: '' };
      let hasAddedMessage = false;

      while (true) {
        const { done, value } = await reader. read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') {
              setCurrentTool(null);
              setToolResult(null);
              break;
            }

            try {
              const data = JSON.parse(dataStr);
              
              // Handle tool calls
              if (data.type === 'tool_call') {
                setCurrentTool(data.toolCall);
                setToolResult(null);
              }
              
              // Handle tool results
              if (data.type === 'tool_result') {
                setToolResult(data.toolResult);
              }
              
              // Handle final text response
              if (data. type === 'text' && data.text) {
                setCurrentTool(null);
                setToolResult(null);
                assistantMessage.text = data.text;
                
                if (!hasAddedMessage) {
                  setMessages(prev => [... prev, { ... assistantMessage }]);
                  hasAddedMessage = true;
                } else {
                  setMessages(prev => {
                    const newMsgs = [...prev];
                    newMsgs[newMsgs.length - 1] = { ...assistantMessage };
                    return newMsgs;
                  });
                }
              }
              
              // Handle errors
              if (data.type === 'error') {
                console.error('Stream error:', data.error);
                assistantMessage.text = `Sorry, an error occurred: ${data.error}`;
                if (!hasAddedMessage) {
                  setMessages(prev => [... prev, { ...assistantMessage }]);
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
            📧 Gmail Connected
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden md:block">{user?.email}</span>
          <button 
            onClick={logout} 
            className="text-sm text-red-500 hover:text-red-700 font-medium"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="text-6xl mb-4">📬</div>
            <p className="text-xl font-medium text-gray-600">
              Good day, {user?.given_name || 'there'}!
            </p>
            <p className="text-gray-400 mb-6">I can help you with your emails</p>
            
            <div className="grid gap-2 text-sm max-w-md">
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 hover:border-blue-200 cursor-pointer transition-all"
                   onClick={() => setInput("Do I have any unread emails? ")}>
                💡 "Do I have any unread emails?"
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 hover:border-blue-200 cursor-pointer transition-all"
                   onClick={() => setInput("Search for emails about invoices")}>
                💡 "Search for emails about invoices"
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 hover:border-blue-200 cursor-pointer transition-all"
                   onClick={() => setInput("What emails did I get today?")}>
                💡 "What emails did I get today?"
              </div>
            </div>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] rounded-2xl p-4 ${
              msg.role === 'user' 
                ?  'bg-blue-600 text-white rounded-br-none' 
                : 'bg-white text-gray-800 shadow-sm rounded-bl-none border border-gray-100'
            }`}>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
            </div>
          </div>
        ))}
        
        {/* Tool activity indicators */}
        {currentTool && (
          <div className="flex justify-start">
            <ToolIndicator toolCall={currentTool} toolResult={toolResult} />
          </div>
        )}
        
        {isTyping && ! currentTool && (
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
            placeholder="Ask about your emails..."
            className="flex-1 p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          <button 
            type="submit" 
            disabled={! input.trim() || isTyping}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}