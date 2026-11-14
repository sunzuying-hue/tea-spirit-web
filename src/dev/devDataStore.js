import {
  DEV_SESSION_KEY,
  DEV_STORAGE_PREFIX,
  DEV_USER,
  isDevSession,
} from './devSession'

export const DEV_PROFILE_KEY = `${DEV_STORAGE_PREFIX}profile`
export const DEV_SPIRIT_KEY = `${DEV_STORAGE_PREFIX}spirit`
export const DEV_LETTERS_KEY = `${DEV_STORAGE_PREFIX}letters`
export const DEV_ONBOARDING_KEY = `${DEV_STORAGE_PREFIX}onboarding`
export const DEV_TEST_SPEED = 120

const STAGE_DURATION_MS = 2 * 60 * 60 * 1000
const LIFETIME_MS = 6 * 60 * 60 * 1000

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') || fallback
  } catch {
    return fallback
  }
}

const writeJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value))
  return value
}

const notify = () => {
  window.dispatchEvent(new CustomEvent('tea-spirit-dev-changed'))
  window.dispatchEvent(new CustomEvent('tea-spirit-user-refresh'))
  window.dispatchEvent(new CustomEvent('tea-spirit-letters-refresh'))
}

export const getDevProfile = () => {
  const stored = readJson(DEV_PROFILE_KEY, null)
  if (stored) return stored
  return writeJson(DEV_PROFILE_KEY, {
    ...DEV_USER,
    avatarUrl: '/profile/tea-spirit-memory.jpg',
    firstVisitAt: Date.now(),
    companionCount: 0,
    authStatus: 'authenticated',
    profileStatus: 'ready',
  })
}

export const saveDevProfile = (updates) => {
  const profile = writeJson(DEV_PROFILE_KEY, { ...getDevProfile(), ...updates })
  notify()
  return profile
}

export const getDevSpirit = () => {
  const stored = readJson(DEV_SPIRIT_KEY, null)
  if (stored) return stored
  return writeJson(DEV_SPIRIT_KEY, {
    id: `dev-spirit-${Date.now()}`,
    user_id: DEV_USER.id,
    obtained_at: new Date().toISOString(),
    stage: 'early',
    status: 'active',
    completed_at: null,
    completion_event_key: null,
  })
}

export const getDevLetters = () =>
  readJson(DEV_LETTERS_KEY, []).sort((a, b) => b.createdAt - a.createdAt)

const saveDevLetters = (letters) => writeJson(DEV_LETTERS_KEY, letters)

export const calculateDevStage = (obtainedAt, now = Date.now()) => {
  const elapsed = Math.max(0, now - new Date(obtainedAt).getTime()) * DEV_TEST_SPEED
  if (elapsed >= LIFETIME_MS) return 'completed'
  if (elapsed >= STAGE_DURATION_MS * 2) return 'late'
  if (elapsed >= STAGE_DURATION_MS) return 'middle'
  return 'early'
}

export const syncDevLifecycle = () => {
  if (!isDevSession()) return null
  const spirit = getDevSpirit()
  if (spirit.status === 'completed') return spirit

  const stage = calculateDevStage(spirit.obtained_at)
  if (stage !== 'completed') {
    const next = { ...spirit, stage }
    writeJson(DEV_SPIRIT_KEY, next)
    return next
  }

  const eventKey = `spirit-grown-${spirit.id}`
  const completed = {
    ...spirit,
    stage: 'completed',
    status: 'completed',
    completed_at: new Date().toISOString(),
    completion_event_key: eventKey,
  }
  writeJson(DEV_SPIRIT_KEY, completed)

  const letters = getDevLetters()
  if (!letters.some((letter) => letter.id === eventKey)) {
    saveDevLetters([{
      id: eventKey,
      eventKey,
      type: 'spirit_grown',
      title: '茶灵长大啦',
      imageUrl: '/letters/spirit-grown.png',
      read: false,
      readAt: null,
      createdAt: Date.now(),
      payload: {},
    }, ...letters])
    const profile = getDevProfile()
    writeJson(DEV_PROFILE_KEY, {
      ...profile,
      companionCount: Number(profile.companionCount || 0) + 1,
    })
  }
  notify()
  return completed
}

export const setDevStage = (stage) => {
  if (!isDevSession()) return null
  if (stage === 'completed') {
    const spirit = getDevSpirit()
    writeJson(DEV_SPIRIT_KEY, {
      ...spirit,
      status: 'active',
      stage: 'late',
      obtained_at: new Date(Date.now() - LIFETIME_MS / DEV_TEST_SPEED - 100).toISOString(),
    })
    const completed = syncDevLifecycle()
    window.dispatchEvent(new CustomEvent('tea-spirit-cloud-changed', { detail: { spirit: completed } }))
    return completed
  }

  const offsets = { early: 0, middle: STAGE_DURATION_MS, late: STAGE_DURATION_MS * 2 }
  const spirit = getDevSpirit()
  const next = {
    ...spirit,
    status: 'active',
    stage,
    completed_at: null,
    completion_event_key: null,
    obtained_at: new Date(Date.now() - offsets[stage] / DEV_TEST_SPEED - 100).toISOString(),
  }
  writeJson(DEV_SPIRIT_KEY, next)
  notify()
  window.dispatchEvent(new CustomEvent('tea-spirit-cloud-changed', { detail: { spirit: next } }))
  return next
}

export const markDevLetterRead = (id) => {
  const next = getDevLetters().map((letter) =>
    letter.id === id ? { ...letter, read: true, readAt: Date.now() } : letter,
  )
  saveDevLetters(next)
  notify()
  return next.find((letter) => letter.id === id) || null
}

export const clearDevOnboarding = () => {
  localStorage.removeItem(DEV_ONBOARDING_KEY)
  window.dispatchEvent(new CustomEvent('tea-spirit-onboarding-reset'))
}

export const hasSeenDevOnboarding = (spiritId) => {
  const state = readJson(DEV_ONBOARDING_KEY, {})
  return state.spiritId === spiritId && state.seen === true
}

export const markDevOnboardingSeen = (spiritId) => {
  writeJson(DEV_ONBOARDING_KEY, { spiritId, seen: true })
}

export const clearDevLetters = () => {
  saveDevLetters([])
  notify()
}

export const resetDevCompanionCount = () => saveDevProfile({ companionCount: 0 })

export const resetDevData = () => {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(DEV_STORAGE_PREFIX))
    .forEach((key) => localStorage.removeItem(key))
  localStorage.setItem(DEV_SESSION_KEY, 'true')
  getDevProfile()
  const spirit = getDevSpirit()
  window.dispatchEvent(new CustomEvent('tea-spirit-onboarding-reset'))
  notify()
  window.dispatchEvent(new CustomEvent('tea-spirit-cloud-changed', { detail: { spirit } }))
  return spirit
}
