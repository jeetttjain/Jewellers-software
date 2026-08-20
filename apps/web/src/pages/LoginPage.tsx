import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { PinKeypadInput } from '../components/common/PinKeypadInput.js';
import { Gem, Lock, Mail, KeyRound, ShieldCheck } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [isPinMode, setIsPinMode] = useState(true);
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('admin@kamaljewellers.com');
  const [password, setPassword] = useState('password123');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, switchPin } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handlePinSubmit = async (pinValue: string) => {
    setIsSubmitting(true);
    try {
      const ok = await switchPin(pinValue);
      if (ok) {
        addToast('Quick PIN Switch Authorized!', 'success');
        navigate('/dashboard');
      } else {
        addToast('Invalid PIN. Please try again.', 'error');
        setPin('');
      }
    } catch (err: any) {
      addToast(err.message || 'Invalid PIN code. Please try again.', 'error');
      setPin('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const ok = await login(email, password);
      if (ok) {
        addToast('Welcome to Kamal Jewellers POS System', 'success');
        navigate('/dashboard');
      } else {
        addToast('Invalid credentials. Please try again.', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Login failed. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 relative z-10 space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 mb-1">
            <Gem className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-white tracking-wide">
            KAMAL JEWELLERS
          </h1>
          <p className="text-xs uppercase tracking-widest text-amber-400/90 font-medium">
            POS & Showroom Inventory Engine
          </p>
        </div>

        {/* Toggle Mode */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => { setIsPinMode(true); setPin(''); }}
            className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
              isPinMode ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Quick 4-Digit PIN
          </button>
          <button
            type="button"
            onClick={() => setIsPinMode(false)}
            className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
              !isPinMode ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Admin Credentials
          </button>
        </div>

        {isPinMode ? (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-xs text-slate-400">Enter 4-Digit Staff / Cashier Security PIN</p>
            </div>
            <PinKeypadInput
              value={pin}
              onChange={setPin}
              onSubmit={handlePinSubmit}
              length={4}
              disabled={isSubmitting}
              ariaLabel="4-Digit Staff / Cashier Security PIN"
            />
          </div>
        ) : (
          /* EMAIL / PASSWORD FORM */
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none"
                  placeholder="admin@kamaljewellers.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:border-amber-500 focus:outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all"
            >
              {isSubmitting ? 'Authenticating...' : 'Sign In to Terminal'}
            </button>
          </form>
        )}
      </div>

      <div className="mt-8 text-center text-xs text-slate-600 flex items-center gap-1">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
        <span>BIS HUID Hallmarking & GST Compliant POS Engine</span>
      </div>
    </div>
  );
};
