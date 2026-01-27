import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import {
  User,
  AuthTokens,
  LoginCredentials,
  RegisterData,
  AuthResponse,
} from '../types/user'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => Promise<void>
  updateUser: (user: User) => void
  refreshToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'auth_tokens'
const USER_KEY = 'auth_user'
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [tokens, setTokens] = useState<AuthTokens | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load stored auth state on mount
  useEffect(() => {
    const storedTokens = localStorage.getItem(TOKEN_KEY)
    const storedUser = localStorage.getItem(USER_KEY)

    if (storedTokens && storedUser) {
      try {
        setTokens(JSON.parse(storedTokens))
        setUser(JSON.parse(storedUser))
      } catch {
        // Invalid stored data, clear it
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
      }
    }
    setIsLoading(false)
  }, [])

  // Save tokens and user to localStorage
  const saveAuth = useCallback((authTokens: AuthTokens, authUser: User) => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(authTokens))
    localStorage.setItem(USER_KEY, JSON.stringify(authUser))
    setTokens(authTokens)
    setUser(authUser)
  }, [])

  // Clear auth state
  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setTokens(null)
    setUser(null)
  }, [])

  // Refresh access token
  const refreshToken = useCallback(async (): Promise<string | null> => {
    if (!tokens?.refresh) return null

    try {
      const response = await fetch(`${API_BASE}/users/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: tokens.refresh }),
      })

      if (!response.ok) {
        clearAuth()
        return null
      }

      const data = await response.json()
      const newTokens: AuthTokens = {
        access: data.access,
        refresh: data.refresh || tokens.refresh,
      }

      localStorage.setItem(TOKEN_KEY, JSON.stringify(newTokens))
      setTokens(newTokens)
      return newTokens.access
    } catch {
      clearAuth()
      return null
    }
  }, [tokens, clearAuth])

  // Login
  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const response = await fetch(`${API_BASE}/users/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.detail || error.non_field_errors?.[0] || 'Login failed')
      }

      const data: AuthResponse = await response.json()
      saveAuth(data.tokens, data.user)
    },
    [saveAuth]
  )

  // Register
  const register = useCallback(
    async (data: RegisterData) => {
      const response = await fetch(`${API_BASE}/users/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        // Extract first error message from response
        const errorMessage =
          error.detail ||
          error.username?.[0] ||
          error.email?.[0] ||
          error.password?.[0] ||
          error.password_confirm?.[0] ||
          error.non_field_errors?.[0] ||
          'Registration failed'
        throw new Error(errorMessage)
      }

      const result: AuthResponse = await response.json()
      saveAuth(result.tokens, result.user)
    },
    [saveAuth]
  )

  // Logout
  const logout = useCallback(async () => {
    if (tokens?.refresh) {
      try {
        await fetch(`${API_BASE}/users/logout/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokens.access}`,
          },
          body: JSON.stringify({ refresh: tokens.refresh }),
        })
      } catch {
        // Ignore logout errors
      }
    }
    clearAuth()
  }, [tokens, clearAuth])

  // Update user
  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser)
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser))
  }, [])

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user && !!tokens,
    isLoading,
    login,
    register,
    logout,
    updateUser,
    refreshToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Export tokens getter for API client
export function getStoredTokens(): AuthTokens | null {
  const stored = localStorage.getItem(TOKEN_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

export function setStoredTokens(tokens: AuthTokens) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
}
