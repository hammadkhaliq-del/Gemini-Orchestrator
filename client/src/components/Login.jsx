import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full border border-gray-100">
        <div className="mb-8">
          <div className="text-5xl mb-4">🤖</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Gemini Orchestrator</h1>
          <p className="text-gray-500">Your AI-powered email assistant</p>
        </div>
        
        <div className="mb-6 text-left bg-gray-50 p-4 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-2">What I can do:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>📧 Search and read your emails</li>
            <li>📊 Summarize email threads</li>
            <li>🔍 Find specific information</li>
            <li>💬 Answer questions about your inbox</li>
          </ul>
        </div>
        
        <button
          onClick={login}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 font-medium py-3 px-4 rounded-xl transition-all shadow-sm"
        >
          <img 
            src="https://www.svgrepo.com/show/475656/google-color.svg" 
            alt="Google" 
            className="w-6 h-6" 
          />
          Sign in with Google
        </button>
        
        <p className="mt-6 text-xs text-gray-400">
          We only request read access to your emails
        </p>
        
        <p className="mt-2 text-xs text-gray-400">
          Powered by Google Gemini • Your data stays private
        </p>
      </div>
    </div>
  );
}