import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const ping = async () => {
      try {
        const res = await axios.get(`${API}/`);
        setMessage(res.data.message);
        setStatus('connected');
      } catch (e) {
        setStatus('error');
      }
    };
    ping();
  }, []);

  const statusStyles = {
    checking: 'bg-yellow-400',
    connected: 'bg-emerald-400',
    error: 'bg-red-400',
  };

  const statusText = {
    checking: 'Checking backend...',
    connected: 'Backend connected',
    error: 'Backend unreachable',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex items-center justify-center px-6">
      <div className="max-w-2xl w-full text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-slate-300 mb-8">
          <span className={`h-2.5 w-2.5 rounded-full ${statusStyles[status]} animate-pulse`}></span>
          {statusText[status]}
          {message && status === 'connected' ? ` · "${message}"` : ''}
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-indigo-300">
          Your app is ready
        </h1>
        <p className="mt-6 text-lg text-slate-400 leading-relaxed">
          The full-stack starter is up and running — React + Tailwind on the
          front end, FastAPI + MongoDB on the back end. Tell me what you&apos;d like
          to build next.
        </p>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-indigo-300 text-sm font-medium">Frontend</div>
            <div className="mt-1 text-slate-200 font-semibold">React 18</div>
            <div className="text-slate-400 text-sm">Tailwind CSS + CRACO</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-indigo-300 text-sm font-medium">Backend</div>
            <div className="mt-1 text-slate-200 font-semibold">FastAPI</div>
            <div className="text-slate-400 text-sm">Async /api routes</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-indigo-300 text-sm font-medium">Database</div>
            <div className="mt-1 text-slate-200 font-semibold">MongoDB</div>
            <div className="text-slate-400 text-sm">Motor async driver</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
