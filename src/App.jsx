import React, { useState } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Home    from './pages/Home'
import Predict from './pages/Predict'
import Admin   from './pages/Admin'

function Navbar({ currentPlayer, onLogout }) {
  const { pathname } = useLocation()
  const links = [
    { to: '/',        label: 'Home' },
    { to: '/predict', label: 'Predict' },
  ]

  const getInitials = (name) => {
    if (!name) return ''
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  }

  return (
    <nav className="sticky top-0 z-50 bg-surface/88 backdrop-blur-xl border-b border-white/6">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink via-orange-500 to-gold flex items-center justify-center flex-shrink-0">
            <span className="font-display font-black text-sm text-black">26</span>
          </div>
          <div className="hidden sm:block">
            <div className="font-display font-bold text-sm text-text tracking-tight leading-none">PREDICTOR</div>
            <div className="font-body text-xs text-muted">WORLD CUP · 26</div>
          </div>
        </Link>

        {/* Center nav */}
        <div className="flex items-center gap-2 flex-1 justify-center">
          {links.map(({ to, label }) => {
            const active = pathname === to || (to !== '/' && pathname.startsWith(to))
            return (
              <Link
                key={to}
                to={to}
                className={`px-4 py-2 text-sm font-medium transition-colors relative
                  ${active ? 'text-text' : 'text-muted hover:text-text'}`}
              >
                {label}
                {active && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gold"></span>
                )}
              </Link>
            )
          })}
        </div>

        {/* User section (right) */}
        {currentPlayer && (
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink via-orange-500 to-gold flex items-center justify-center flex-shrink-0">
              <span className="font-display font-bold text-xs text-black">{getInitials(currentPlayer.name)}</span>
            </div>
            <button
              onClick={onLogout}
              className="text-xs text-muted hover:text-text transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}

export default function App() {
  const [currentPlayer, setCurrentPlayer] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wc2026_player') || 'null') }
    catch { return null }
  })

  const handleLogout = () => {
    localStorage.removeItem('wc2026_player')
    setCurrentPlayer(null)
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <Navbar currentPlayer={currentPlayer} onLogout={handleLogout} />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home currentPlayer={currentPlayer} setCurrentPlayer={setCurrentPlayer} />} />
          <Route path="/predict" element={<Predict currentPlayer={currentPlayer} />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </div>
  )
}
