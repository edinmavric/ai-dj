import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/common'
import styles from './NotFound.module.css'

export const NotFound: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>404</h1>
        <p className={styles.message}>Lost in the Upside Down...</p>
        <Button variant="primary" onClick={() => navigate('/')}>
          Return to Hawkins
        </Button>
      </div>
    </div>
  )
}

export default NotFound
