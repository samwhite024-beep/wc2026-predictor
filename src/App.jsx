import React from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Home        from './pages/Home'
import Predict     from './pages/Predict'
import Leaderboard from './pages/Leaderboard'
import Admin       from './pages/Admin'

function Navbar() {
  const { pathname } = useLocation()
  const links = [
    { to: '/',            label: '🏠 Home' },
    { to: '/predict',     label: '✏️ Predict' },
    { to: '/leaderboard', label: '🏆 Leaderboard' },
  ]
  return (
    <nav className="bg-gray-900 text-white sticky top-0 z-50 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <span>⚽</span>
          <span className="text-brand-light">WC 2026</span>
          <span className="text-gray-400 font-normal text-sm hidden sm:inline">Predictor</span>
        </Link>
        <div className="flex items-center gap-1">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${pathname === to
                  ? 'bg-brand text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/"            element={<Home />} />
          <Route path="/predict"     element={<Predict />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/admin"       element={<Admin />} />
        </Routes>
      </main>
      <footer className="bg-gray-900 text-gray-500 text-center text-xs py-4 mt-8">
        FIFA World Cup 2026 · USA · Canada · Mexico · 11 Jun – 19 Jul
      </footer>
    </div>
  )
}
