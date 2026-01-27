import { gameApi } from './game'
import { userApi } from './user'

export const api = {
  ...gameApi,
  ...userApi,
}

export { apiClient } from './client'
export { gameApi } from './game'
export { userApi } from './user'
