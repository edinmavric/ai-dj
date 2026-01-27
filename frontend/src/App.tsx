import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Home from './pages/Home'
import Game from './pages/Game'
import Login from './pages/Login'
import Register from './pages/Register'
import Leaderboard from './pages/Leaderboard'
import Profile from './pages/Profile'
import MatchHistory from './pages/MatchHistory'
import NotFound from './pages/NotFound'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/game/:gameId" element={<Game />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/profile/:userId" element={<Profile />} />
            <Route path="/history" element={<MatchHistory />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
