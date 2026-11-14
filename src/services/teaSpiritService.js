import { assertCloudResult, cloudbaseDb } from './cloudbaseClient'
import { getCurrentUser } from './authService'
import { getOrCreateUser } from './userService'
import { getLetters } from './letterService'
import {
  getDevSpirit,
  setDevStage,
  syncDevLifecycle,
} from '../dev/devDataStore'
import { isDevSession } from '../dev/devSession'

export const SPIRIT_STAGE_DURATION_MS = 2 * 60 * 60 * 1000
export const SPIRIT_LIFETIME_MS = 6 * 60 * 60 * 1000
// GitHub 演示测试版：120 倍速，即每阶段 1 分钟、完整周期 3 分钟。
export const TEST_SPEED = 120

let pendingLifecycleSync = null

export const calculateStage = (obtainedAt, now = Date.now()) => {
  const elapsed = Math.max(0, now - new Date(obtainedAt).getTime()) * TEST_SPEED
  if (elapsed >= SPIRIT_LIFETIME_MS) return 'completed'
  if (elapsed >= SPIRIT_STAGE_DURATION_MS * 2) return 'late'
  if (elapsed >= SPIRIT_STAGE_DURATION_MS) return 'middle'
  return 'early'
}

const requireCloudIdentity = async () => {
  const identity = await getCurrentUser()
  return identity?.isCloudAuthenticated ? identity : null
}

export const getCurrentTeaSpirit = async (userId) => {
  if (isDevSession()) {
    const spirit = getDevSpirit()
    return spirit.status === 'active' ? spirit : null
  }
  if (!(await requireCloudIdentity()) || !userId) return null
  const result = await cloudbaseDb.from('tea_spirits').select('*')
    .eq('user_id', userId).eq('status', 'active')
    .order('obtained_at', { ascending: false }).limit(1).maybeSingle()
  return assertCloudResult(result, 'getCurrentTeaSpirit')
}

export const getLatestTeaSpirit = async (userId) => {
  if (isDevSession()) return getDevSpirit()
  if (!(await requireCloudIdentity()) || !userId) return null
  const result = await cloudbaseDb.from('tea_spirits').select('*')
    .eq('user_id', userId)
    .order('obtained_at', { ascending: false }).limit(1).maybeSingle()
  return assertCloudResult(result, 'getLatestTeaSpirit')
}

export const createTeaSpirit = async ({ userId, obtainedAt = Date.now() }) => {
  if (isDevSession()) return getDevSpirit()
  if (!(await requireCloudIdentity()) || !userId) return null
  const obtainedDate = new Date(obtainedAt)
  try {
    const result = await cloudbaseDb.from('tea_spirits').insert({
      user_id: userId,
      obtained_at: obtainedDate.toISOString(),
      stage: calculateStage(obtainedDate),
      status: 'active',
    }).select('*').single()
    return assertCloudResult(result, 'createTeaSpirit')
  } catch (error) {
    // Another tab/device may have created the first active spirit concurrently.
    // The database partial unique index is authoritative; read that row instead.
    const existing = await getCurrentTeaSpirit(userId)
    if (existing) return existing
    throw error
  }
}

export const migrateLocalTeaSpiritOnce = async ({ userId, obtainedAt }) => {
  const existing = await getLatestTeaSpirit(userId)
  // A completed spirit remains the latest spirit. Never create the next one here.
  const spirit = existing || await createTeaSpirit({
    userId,
    obtainedAt: Number.isFinite(obtainedAt) ? obtainedAt : Date.now(),
  })
  return spirit
}

export const completeTeaSpirit = async (teaSpiritId) => {
  if (isDevSession()) return setDevStage('completed')
  if (!(await requireCloudIdentity()) || !teaSpiritId) return null
  if (import.meta.env.DEV) console.info('[Lifecycle] completing tea spirit:', teaSpiritId)
  try {
    const result = await cloudbaseDb.rpc('complete_tea_spirit', {
      p_tea_spirit_id: teaSpiritId,
    })
    const completed = assertCloudResult(result, 'completeTeaSpirit')
    if (import.meta.env.DEV) {
      console.info(completed
        ? '[Lifecycle] completion success'
        : '[Lifecycle] already completed')
    }
    window.dispatchEvent(new CustomEvent('tea-spirit-user-refresh'))
    window.dispatchEvent(new CustomEvent('tea-spirit-letters-refresh'))
    return completed
  } catch (error) {
    console.error('[Lifecycle] completion failed', {
      code: error?.code || 'UNKNOWN',
      message: error?.message || 'Unknown error',
    })
    window.dispatchEvent(new CustomEvent('tea-spirit-lifecycle-error', {
      detail: {
        code: error?.code || 'UNKNOWN',
        message: error?.message || 'Unknown error',
      },
    }))
    throw error
  }
}

const synchronizeLifecycle = async () => {
  if (isDevSession()) {
    const spirit = syncDevLifecycle()
    const profile = await getOrCreateUser()
    const letters = await getLetters(profile.id)
    window.dispatchEvent(new CustomEvent('tea-spirit-cloud-changed', {
      detail: { spirit },
    }))
    window.dispatchEvent(new CustomEvent('tea-spirit-user-refresh', {
      detail: { profile },
    }))
    window.dispatchEvent(new CustomEvent('tea-spirit-letters-refresh', {
      detail: { letters },
    }))
    return spirit
  }
  const profile = await getOrCreateUser()
  if (!profile.id || profile.authStatus !== 'authenticated') return null

  let spirit = await migrateLocalTeaSpiritOnce({
    userId: profile.id,
    // This is only used when this cloud user has never had a tea spirit.
    obtainedAt: Date.now(),
  })
  if (!spirit) return null

  const elapsed = Math.max(0, Date.now() - new Date(spirit.obtained_at).getTime()) * TEST_SPEED
  if (elapsed >= SPIRIT_LIFETIME_MS) {
    if (import.meta.env.DEV) console.info('[Lifecycle] elapsed reached completed stage')
    if (spirit.status !== 'completed') {
      await completeTeaSpirit(spirit.id)
      spirit = await getLatestTeaSpirit(profile.id)
    } else if (import.meta.env.DEV) {
      console.info('[Lifecycle] already completed')
    }
  }

  // CloudBase is the source of truth. Re-read all data affected by a possible
  // completion before notifying pages, so returning users see the mature
  // spirit, companion count and first letter without a manual refresh.
  const refreshedProfile = await getOrCreateUser()
  const letters = await getLetters(profile.id)

  window.dispatchEvent(new CustomEvent('tea-spirit-cloud-changed', {
    detail: { spirit },
  }))
  window.dispatchEvent(new CustomEvent('tea-spirit-user-refresh', {
    detail: { profile: refreshedProfile },
  }))
  window.dispatchEvent(new CustomEvent('tea-spirit-letters-refresh', {
    detail: { letters },
  }))
  return spirit
}

export const syncTeaSpiritLifecycle = async () => {
  if (pendingLifecycleSync) return pendingLifecycleSync
  pendingLifecycleSync = synchronizeLifecycle()
  try {
    return await pendingLifecycleSync
  } finally {
    pendingLifecycleSync = null
  }
}

export const syncUserLifecycle = syncTeaSpiritLifecycle
