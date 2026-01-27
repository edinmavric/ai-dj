import { getStoredTokens, setStoredTokens } from '../contexts/AuthContext'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

interface RequestOptions extends RequestInit {
  params?: Record<string, string>
  skipAuth?: boolean
}

class ApiClient {
  private baseUrl: string
  private isRefreshing = false
  private refreshQueue: Array<{
    resolve: (token: string) => void
    reject: (error: Error) => void
  }> = []

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async refreshToken(): Promise<string | null> {
    const tokens = getStoredTokens()
    if (!tokens?.refresh) return null

    try {
      const response = await fetch(`${this.baseUrl}/users/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: tokens.refresh }),
      })

      if (!response.ok) {
        // Clear tokens on refresh failure
        localStorage.removeItem('auth_tokens')
        localStorage.removeItem('auth_user')
        return null
      }

      const data = await response.json()
      const newTokens = {
        access: data.access,
        refresh: data.refresh || tokens.refresh,
      }
      setStoredTokens(newTokens)
      return newTokens.access
    } catch {
      localStorage.removeItem('auth_tokens')
      localStorage.removeItem('auth_user')
      return null
    }
  }

  private async getAccessToken(): Promise<string | null> {
    const tokens = getStoredTokens()
    return tokens?.access || null
  }

  private async handleTokenRefresh(): Promise<string | null> {
    if (this.isRefreshing) {
      // Wait for the ongoing refresh to complete
      return new Promise((resolve, reject) => {
        this.refreshQueue.push({ resolve, reject })
      })
    }

    this.isRefreshing = true

    try {
      const newToken = await this.refreshToken()

      // Resolve all queued requests
      this.refreshQueue.forEach(({ resolve }) => {
        if (newToken) {
          resolve(newToken)
        }
      })
      this.refreshQueue = []

      return newToken
    } catch (error) {
      // Reject all queued requests
      this.refreshQueue.forEach(({ reject }) => {
        reject(error as Error)
      })
      this.refreshQueue = []
      throw error
    } finally {
      this.isRefreshing = false
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {},
    isRetry = false
  ): Promise<T> {
    const { params, skipAuth, ...fetchOptions } = options

    let url = `${this.baseUrl}${endpoint}`
    if (params) {
      const searchParams = new URLSearchParams(params)
      url += `?${searchParams.toString()}`
    }

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers as Record<string, string>),
    }

    // Add auth header if authenticated and not skipping auth
    if (!skipAuth) {
      const token = await this.getAccessToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    })

    // Handle 401 Unauthorized - try to refresh token
    if (response.status === 401 && !isRetry && !skipAuth) {
      const newToken = await this.handleTokenRefresh()
      if (newToken) {
        // Retry the request with new token
        return this.request<T>(endpoint, options, true)
      }
      // No token available, throw auth error
      throw new Error('Session expired. Please log in again.')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(
        error.detail ||
          error.message ||
          error.non_field_errors?.[0] ||
          `HTTP error ${response.status}`
      )
    }

    // Handle empty responses
    const text = await response.text()
    if (!text) {
      return {} as T
    }

    return JSON.parse(text)
  }

  async get<T>(
    endpoint: string,
    params?: Record<string, string>,
    options?: Omit<RequestOptions, 'params'>
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params, ...options })
  }

  async post<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    })
  }

  async put<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    })
  }

  async patch<T>(endpoint: string, data?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    })
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', ...options })
  }
}

export const apiClient = new ApiClient(API_BASE_URL)
export default apiClient
