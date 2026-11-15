import { getCurrentUser, loginWithWeChat } from './authService'
import { assertCloudResult, cloudbaseDb } from './cloudbaseClient'
import { getDevProfile, saveDevProfile } from '../dev/devDataStore'
import { isDevSession } from '../dev/devSession'
import { publicAssetUrl } from '../utils/publicAssetUrl'

export const USER_STORAGE_KEY = 'teaSpiritUser'

const EMPTY_PROFILE = {
  id: null,
  userId: null,
  authProvider: null,
  authSubject: null,
  nickname: '未登录',
  avatarUrl: '/profile/tea-spirit-memory.jpg',
  firstVisitAt: null,
  companionCount: 0,
  authStatus: 'unauthenticated',
  profileStatus: 'ready',
  profileError: null,
}

let pendingGetOrCreateUser = null

const normalizeProfile = (profile = {}) => ({
  ...EMPTY_PROFILE,
  ...profile,
  id: profile.id || profile.userId || null,
  userId: profile.id || profile.userId || null,
  authProvider: profile.auth_provider || profile.authProvider || null,
  authUid: profile.auth_uid || profile.authUid || null,
  avatarUrl: publicAssetUrl(profile.avatar_url || profile.avatarUrl || EMPTY_PROFILE.avatarUrl),
  firstVisitAt: profile.first_visit_at
    ? new Date(profile.first_visit_at).getTime()
    : profile.firstVisitAt || null,
  companionCount: Number(profile.companion_count ?? profile.companionCount ?? 0),
})

const readStoredProfile = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || 'null')
    return stored && typeof stored === 'object' ? normalizeProfile(stored) : null
  } catch (error) {
    console.error('Failed to read cached tea spirit user:', error)
    return null
  }
}

export const getCachedUserProfile = () =>
  isDevSession() ? getDevProfile() : readStoredProfile() || { ...EMPTY_PROFILE }

export const saveUserProfileCache = (profile) => {
  if (isDevSession()) return saveDevProfile(profile)
  const current = readStoredProfile()
  const next = normalizeProfile({
    ...current,
    ...profile,
    firstVisitAt: profile.firstVisitAt ?? current?.firstVisitAt ?? null,
  })
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent('tea-spirit-user-changed'))
  return next
}

const loadOrCreateCloudUser = async () => {
  const identity = await getCurrentUser()
  if (!identity) return getCachedUserProfile()

  // A dev identity stays local-only. Without a verifiable CloudBase JWT it cannot be
  // mapped safely by PostgreSQL RLS and must never be treated as a real openid.
  if (!identity.isCloudAuthenticated) {
    return getDevProfile()
  }

  if (import.meta.env.DEV) console.info('[UserService] looking up user')
  const lookup = await cloudbaseDb.from('users').select('*')
    .eq('auth_uid', identity.authUid).maybeSingle()
  const existing = assertCloudResult(lookup, 'getOrCreateUser.lookup')
  if (existing) {
    if (import.meta.env.DEV) console.info('[UserService] user loaded')
    return saveUserProfileCache(normalizeProfile({
      ...existing,
      authStatus: 'authenticated',
      profileStatus: 'ready',
    }))
  }

  let created
  try {
    created = await cloudbaseDb.from('users').insert({
      auth_uid: identity.authUid,
      auth_provider: 'phone',
      phone: identity.phone,
      openid: null,
      unionid: null,
      nickname: '茶友',
      first_visit_at: new Date().toISOString(),
      companion_count: 0,
    }).select('*').single()
  } catch (error) {
    // A simultaneous first login in another tab/device may win the UNIQUE
    // auth_uid insert. Re-read the stable cloud identity without replacing
    // first_visit_at.
    const retry = await cloudbaseDb.from('users').select('*')
      .eq('auth_uid', identity.authUid).maybeSingle()
    const concurrentUser = assertCloudResult(retry, 'getOrCreateUser.retry')
    if (concurrentUser) {
      return saveUserProfileCache(normalizeProfile({
        ...concurrentUser,
        authStatus: 'authenticated',
        profileStatus: 'ready',
      }))
    }
    throw error
  }
  if (import.meta.env.DEV) console.info('[UserService] user created')
  return saveUserProfileCache(normalizeProfile({
    ...assertCloudResult(created, 'getOrCreateUser.create'),
    authStatus: 'authenticated',
    profileStatus: 'ready',
  }))
}

export const getOrCreateUser = async () => {
  if (pendingGetOrCreateUser) return pendingGetOrCreateUser
  pendingGetOrCreateUser = loadOrCreateCloudUser()
  try {
    return await pendingGetOrCreateUser
  } finally {
    pendingGetOrCreateUser = null
  }
}

export const getUserProfile = async () => {
  const identity = await getCurrentUser()
  if (isDevSession()) return getDevProfile()
  if (!identity?.isCloudAuthenticated) return getCachedUserProfile()
  try {
    return await getOrCreateUser()
  } catch (error) {
    const errorCode = error?.code || 'UNKNOWN'
    const errorMessage = error?.message || 'Unknown CloudBase database error'
    console.error('[UserService] Failed to load CloudBase users profile:', {
      code: errorCode,
      message: errorMessage,
      error,
    })
    const cached = getCachedUserProfile()
    const sameUserCache = cached.authUid === identity.authUid ? cached : {}
    return normalizeProfile({
      ...sameUserCache,
      authProvider: identity.authProvider,
      authUid: identity.authUid,
      nickname: identity.phone ? `茶友${identity.phone.slice(-4)}` : '茶友',
      authStatus: 'authenticated',
      profileStatus: 'error',
      profileError: { code: errorCode, message: errorMessage },
    })
  }
}

export const updateUserProfile = async (updates) => {
  const profile = getCachedUserProfile()
  const identity = await getCurrentUser()
  if (!identity?.isCloudAuthenticated || !profile.id) return saveUserProfileCache(updates)
  const result = await cloudbaseDb.from('users').update({
    nickname: updates.nickname,
    avatar_url: updates.avatarUrl,
    updated_at: new Date().toISOString(),
  }).eq('id', profile.id).select('*').single()
  return saveUserProfileCache(assertCloudResult(result, 'updateUserProfile'))
}

export const incrementCompanionCount = async () => {
  // Cloud increments happen only inside complete_tea_spirit(), atomically.
  const profile = getCachedUserProfile()
  return saveUserProfileCache({ companionCount: profile.companionCount + 1 })
}

export { loginWithWeChat }
