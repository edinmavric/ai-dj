import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/common'
import styles from './Register.module.css'

export const Register: React.FC = () => {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (password !== passwordConfirm) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    try {
      await register({
        username,
        email,
        password,
        password_confirm: passwordConfirm,
      })
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h1 className={styles.title}>STRANGER THINGS</h1>
          <p className={styles.subtitle}>Create Account</p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
              required
              minLength={3}
              maxLength={20}
              disabled={isLoading}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={isLoading}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              required
              minLength={8}
              disabled={isLoading}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label} htmlFor="passwordConfirm">
              Confirm Password
            </label>
            <input
              id="passwordConfirm"
              type="password"
              className={styles.input}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="Confirm your password"
              required
              minLength={8}
              disabled={isLoading}
            />
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <Button
            variant="primary"
            size="large"
            fullWidth
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </Button>

          <div className={styles.footer}>
            <p className={styles.footerText}>
              Already have an account?{' '}
              <Link to="/login" className={styles.link}>
                Sign In
              </Link>
            </p>
            <Link to="/" className={styles.backLink}>
              Back to Home
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Register
