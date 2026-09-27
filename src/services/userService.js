export const USER_STORAGE_KEY = 'teaSpiritUser'

const EMPTY_PROFILE = {
  userId: null,
  nickname: '未登录',
  avatarUrl: '/profile/tea-spirit-memory.jpg',
  firstVisitAt: null,
  companionCount: 0,
}

const readStoredProfile = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(USER_STORAGE_KEY) || 'null')
    return stored && typeof stored === 'object' ? stored : null
  } catch (error) {
    console.error('Failed to read tea spirit user:', error)
    return null
  }
}

export const getUserProfile = () => {
  const stored = readStoredProfile()
  return {
    ...EMPTY_PROFILE,
    ...stored,
    companionCount: Number.isFinite(Number(stored?.companionCount))
      ? Number(stored.companionCount)
      : 0,
  }
}

export const saveUserProfile = (profile) => {
  const stored = readStoredProfile()
  const nextProfile = {
    ...EMPTY_PROFILE,
    ...stored,
    ...profile,
    firstVisitAt: stored?.firstVisitAt || profile.firstVisitAt || null,
  }

  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextProfile))
  window.dispatchEvent(new CustomEvent('tea-spirit-user-changed'))
  return nextProfile
}

export const loginWithWeChat = async () => {
  // TODO: Replace this local prototype with CloudBase WeChat authorization.
  // The backend version should return openid/userId and persist firstVisitAt there.
  const currentProfile = getUserProfile()
  return saveUserProfile({
    ...currentProfile,
    userId: 'local-demo-user',
    nickname: '茶友小叶',
    avatarUrl: '/profile/tea-spirit-memory.jpg',
    firstVisitAt: currentProfile.firstVisitAt || Date.now(),
  })
}

export const incrementCompanionCount = () => {
  const profile = getUserProfile()
  return saveUserProfile({
    ...profile,
    companionCount: profile.companionCount + 1,
  })
}

// Future backend migration:
// - Move teaSpiritUser to the CloudBase users table.
// - Populate userId/openid, nickname and avatar from WeChat authorization.
// - Persist firstVisitAt and companionCount on the server.
// - Increment companionCount from the server-side lifecycle completion event.
