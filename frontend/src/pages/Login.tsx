import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function AccountingIllustration() {
  return (
    <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-md opacity-90">
      {/* Calculator body */}
      <rect x="140" y="60" width="120" height="160" rx="12" fill="white" fillOpacity="0.15" stroke="white" strokeOpacity="0.3" strokeWidth="2" />
      <rect x="155" y="75" width="90" height="30" rx="4" fill="white" fillOpacity="0.2" />
      <text x="235" y="96" fill="white" fillOpacity="0.7" fontSize="14" fontFamily="monospace" textAnchor="end">1,250.00</text>
      {/* Calculator buttons */}
      {[0, 1, 2, 3].map((row) =>
        [0, 1, 2].map((col) => (
          <rect key={`${row}-${col}`} x={155 + col * 30} y={115 + row * 25} width="24" height="18" rx="3" fill="white" fillOpacity={col === 2 && row === 3 ? 0.3 : 0.12} />
        ))
      )}

      {/* Bar chart */}
      <g transform="translate(30, 100)">
        <rect x="0" y="80" width="20" height="60" rx="3" fill="white" fillOpacity="0.2" />
        <rect x="28" y="50" width="20" height="90" rx="3" fill="white" fillOpacity="0.25" />
        <rect x="56" y="30" width="20" height="110" rx="3" fill="white" fillOpacity="0.3" />
        <rect x="84" y="60" width="20" height="80" rx="3" fill="white" fillOpacity="0.2" />
        <line x1="0" y1="140" x2="104" y2="140" stroke="white" strokeOpacity="0.2" strokeWidth="1" />
      </g>

      {/* Document / receipt */}
      <g transform="translate(290, 80)">
        <rect x="0" y="0" width="70" height="90" rx="6" fill="white" fillOpacity="0.15" stroke="white" strokeOpacity="0.25" strokeWidth="1.5" />
        <line x1="12" y1="20" x2="58" y2="20" stroke="white" strokeOpacity="0.2" strokeWidth="1.5" />
        <line x1="12" y1="32" x2="50" y2="32" stroke="white" strokeOpacity="0.15" strokeWidth="1.5" />
        <line x1="12" y1="44" x2="54" y2="44" stroke="white" strokeOpacity="0.15" strokeWidth="1.5" />
        <line x1="12" y1="56" x2="42" y2="56" stroke="white" strokeOpacity="0.15" strokeWidth="1.5" />
        <line x1="30" y1="70" x2="58" y2="70" stroke="white" strokeOpacity="0.3" strokeWidth="2" />
      </g>

      {/* Coin stack */}
      <g transform="translate(50, 50)">
        {[0, 1, 2].map((i) => (
          <ellipse key={i} cx="20" cy={30 - i * 8} rx="18" ry="6" fill="white" fillOpacity={0.1 + i * 0.05} stroke="white" strokeOpacity="0.2" strokeWidth="1" />
        ))}
      </g>

      {/* Trend line */}
      <polyline points="50,260 120,240 200,250 280,220 350,200" fill="none" stroke="white" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="350" cy="200" r="4" fill="white" fillOpacity="0.4" />
    </svg>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.mustChangePassword) {
        navigate('/change-password');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel -- illustration */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-400 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <AccountingIllustration />
          <h2 className="text-3xl font-bold text-white mt-8">HateBookkeeping</h2>
          <p className="text-blue-200 mt-3 text-lg max-w-sm leading-relaxed">
            Financial management made simple. Track invoices, expenses, and cash flow all in one place.
          </p>
        </div>
      </div>

      {/* Right panel -- login form */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">HateBookkeeping</h1>
            <p className="text-sm text-gray-500 mt-1">Financial management made simple</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-8">
            <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
            <p className="text-sm text-gray-500 mb-6">Sign in to your account</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white rounded py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
