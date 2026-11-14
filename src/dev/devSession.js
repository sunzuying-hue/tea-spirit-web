export const DEV_STORAGE_PREFIX = 'tea_spirit_dev_'
export const DEV_SESSION_KEY = `${DEV_STORAGE_PREFIX}session`

export const DEV_USER = Object.freeze({
  id: 'dev-local-user',
  userId: 'dev-local-user',
  authUid: 'dev-local-user',
  authProvider: 'dev',
  authSubject: 'dev-local-user',
  nickname: '本地测试用户',
  isCloudAuthenticated: false,
})

export const isDevSession = () => {
  if (!import.meta.env.DEV) return false
  return localStorage.getItem(DEV_SESSION_KEY) === 'true'
}

export const startDevSession = () => {
  if (!import.meta.env.DEV) return null
  localStorage.setItem(DEV_SESSION_KEY, 'true')
  window.dispatchEvent(new CustomEvent('tea-spirit-auth-changed'))
  return DEV_USER
}

export const endDevSession = () => {
  if (!import.meta.env.DEV) return
  localStorage.removeItem(DEV_SESSION_KEY)
  window.dispatchEvent(new CustomEvent('tea-spirit-auth-changed'))
}
