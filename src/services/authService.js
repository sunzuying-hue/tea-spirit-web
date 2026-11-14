import { cloudbaseAuth } from './cloudbaseClient'
import {
  DEV_USER,
  endDevSession,
  isDevSession,
  startDevSession,
} from '../dev/devSession'

export const AUTH_STORAGE_KEY = 'teaSpiritAuth'
export const AUTH_PROVIDER_STORAGE_KEY = 'teaSpiritAuthProvider'
let pendingPhoneVerification = null
let pendingPhoneNumber = ''

const debugLog = (...values) => {
  if (import.meta.env.DEV) console.info(...values)
}

const maskPhone = (phone) => `****${phone.slice(-4)}`
const maskUid = (uid) => uid.length > 10 ? `${uid.slice(0, 6)}…${uid.slice(-4)}` : uid

const readDevAuth = () => {
  if (!import.meta.env.DEV) return null
  try {
    const value = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null')
    return value?.authProvider === 'dev' ? value : null
  } catch (error) {
    console.error('Failed to read local development identity:', error)
    return null
  }
}

export const getCurrentUser = async () => {
  if (isDevSession()) return DEV_USER
  const cloudUser = await cloudbaseAuth.getCurrentUser()
  const uid = cloudUser?.uid || cloudUser?.id
  if (uid) {
    debugLog('[Auth] current uid:', maskUid(uid))
    return {
      authProvider: localStorage.getItem(AUTH_PROVIDER_STORAGE_KEY) || 'phone',
      authUid: uid,
      authSubject: uid,
      phone: cloudUser.phoneNumber || cloudUser.phone_number || cloudUser.phone || null,
      cloudUser,
      isCloudAuthenticated: true,
    }
  }

  const devUser = readDevAuth()
  return devUser ? { ...devUser, isCloudAuthenticated: false } : null
}

export const getUserId = async () => (await getCurrentUser())?.authUid || null

const normalizePhone = (phoneNumber) => phoneNumber.replace(/[\s-]/g, '')

export const sendPhoneVerificationCode = async (phoneNumber) => {
  const phone = normalizePhone(phoneNumber)
  if (!/^(?:\+?86)?1\d{10}$/.test(phone)) {
    return { success: false, error: '请输入正确的中国大陆手机号' }
  }
  const normalized = phone.startsWith('+86') ? phone : phone.startsWith('86') ? `+${phone}` : `+86${phone}`
  debugLog('[Auth] sending SMS...', maskPhone(normalized))
  const { data, error } = await cloudbaseAuth.signInWithOtp({
    phone: normalized,
    options: { shouldCreateUser: true },
  })
  if (error || !data?.verifyOtp) {
    if (import.meta.env.DEV) console.error('[Auth] SMS failed:', error?.code, error?.message)
    return { success: false, error: error?.message || '验证码发送失败' }
  }
  pendingPhoneVerification = data.verifyOtp
  pendingPhoneNumber = normalized
  debugLog('[Auth] SMS sent', maskPhone(normalized))
  return { success: true }
}

export const signInWithPhoneVerificationCode = async (phoneNumber, code) => {
  const phone = normalizePhone(phoneNumber)
  const normalized = phone.startsWith('+86') ? phone : phone.startsWith('86') ? `+${phone}` : `+86${phone}`
  if (!pendingPhoneVerification || normalized !== pendingPhoneNumber) {
    return { success: false, error: '请先获取验证码' }
  }
  debugLog('[Auth] verifying code...', maskPhone(normalized))
  const { data, error } = await pendingPhoneVerification({ token: code.trim() })
  if (error) {
    if (import.meta.env.DEV) console.error('[Auth] login failed:', error.code, error.message)
    return { success: false, error: error.message || '验证码验证失败' }
  }
  const uid = data?.user?.uid || data?.user?.id || data?.user?.sub
  if (!uid) return { success: false, error: '登录成功但未取得 CloudBase UID' }
  localStorage.setItem(AUTH_PROVIDER_STORAGE_KEY, 'phone')
  pendingPhoneVerification = null
  pendingPhoneNumber = ''
  debugLog('[Auth] login success')
  debugLog('[Auth] uid:', maskUid(uid))
  window.dispatchEvent(new CustomEvent('tea-spirit-auth-changed'))
  return { success: true, uid, user: data.user }
}

export const subscribeToAuthChanges = (callback) => {
  const result = cloudbaseAuth.onAuthStateChange(() => callback())
  return () => result?.data?.subscription?.unsubscribe?.()
}

export const loginWithWeChat = async () => ({
  configured: false,
  reason: 'WECHAT_OAUTH_NOT_CONFIGURED',
  message: '当前尚未配置微信公众号网页 OAuth、AppID 与合法回调域名。',
})

export const loginWithApple = async () => ({
  configured: false,
  reason: 'APPLE_SIGN_IN_NOT_CONFIGURED',
})

export const loginAsDevUser = async () => {
  if (!import.meta.env.DEV) return null
  return startDevSession()
}

export const logout = async () => {
  const current = await getCurrentUser()
  if (current?.isCloudAuthenticated) await cloudbaseAuth.signOut()
  endDevSession()
  localStorage.removeItem(AUTH_STORAGE_KEY)
  localStorage.removeItem(AUTH_PROVIDER_STORAGE_KEY)
  window.dispatchEvent(new CustomEvent('tea-spirit-auth-changed'))
}
