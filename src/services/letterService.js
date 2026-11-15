export const LETTERS_STORAGE_KEY = 'teaSpiritLetters'
export const SPIRIT_OBTAINED_AT_KEY = 'teaSpiritObtainedAt'

import { getCurrentUser } from './authService'
import { assertCloudResult, cloudbaseDb } from './cloudbaseClient'
import { getDevLetters, markDevLetterRead } from '../dev/devDataStore'
import { isDevSession } from '../dev/devSession'
import { publicAssetUrl } from '../utils/publicAssetUrl'

const SPIRIT_LIFETIME_MS = 6 * 60 * 60 * 1000

// Dates verified against the Hong Kong Observatory Gregorian/Lunar calendars.
// Extend this table as new years are needed; trigger evaluation stays unchanged.
export const HOLIDAY_CONFIG = {
  2026: { midAutumn: '2026-09-25', springFestival: '2026-02-17' },
  2027: { midAutumn: '2027-09-15', springFestival: '2027-02-06' },
  2028: { midAutumn: '2028-10-03', springFestival: '2028-01-26' },
  2029: { midAutumn: '2029-09-22', springFestival: '2029-02-13' },
  2030: { midAutumn: '2030-09-12', springFestival: '2030-02-03' },
}

const LETTER_TEMPLATES = {
  spirit_grown: {
    title: '茶灵长大啦',
    imageUrl: '/letters/spirit-grown.png',
  },
  mid_autumn: {
    title: '中秋来信',
    imageUrl: '/letters/mid-autumn.png',
  },
  spring_festival: {
    title: '春节来信',
    imageUrl: '/letters/spring-festival.png',
  },
}

const readStoredLetters = () => {
  try {
    const value = JSON.parse(localStorage.getItem(LETTERS_STORAGE_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch (error) {
    console.error('Failed to read tea spirit letters:', error)
    return []
  }
}

const saveLetters = (letters, notify = true) => {
  localStorage.setItem(LETTERS_STORAGE_KEY, JSON.stringify(letters))
  if (notify) window.dispatchEvent(new CustomEvent('tea-spirit-letters-changed'))
}

export const getCachedLetters = () =>
  readStoredLetters()
    .map((letter) => ({ ...letter, imageUrl: publicAssetUrl(letter.imageUrl) }))
    .sort((a, b) => b.createdAt - a.createdAt)

export const createLocalLetter = ({ id, eventKey = id, type, createdAt = Date.now(), payload = {} }) => {
  const letters = readStoredLetters()
  if (letters.some((letter) => letter.id === eventKey)) return null

  const template = LETTER_TEMPLATES[type]
  if (!template) throw new Error(`Unknown letter type: ${type}`)

  const letter = {
    id: eventKey,
    eventKey,
    type,
    title: template.title,
    createdAt,
    imageUrl: template.imageUrl,
    read: false,
    payload,
  }

  saveLetters([...letters, letter].sort((a, b) => b.createdAt - a.createdAt))
  return letter
}

const markCachedLetterRead = (id) => {
  const letters = readStoredLetters()
  const nextLetters = letters.map((letter) =>
    letter.id === id ? { ...letter, read: true, readAt: Date.now() } : letter,
  )
  saveLetters(nextLetters)
  return nextLetters.find((letter) => letter.id === id) || null
}

const normalizeCloudLetter = (letter) => ({
  ...letter,
  eventKey: letter.event_key,
  imageUrl: publicAssetUrl(letter.image_url),
  createdAt: new Date(letter.created_at).getTime(),
  readAt: letter.read_at ? new Date(letter.read_at).getTime() : null,
})

export const getLetters = async (userId) => {
  if (isDevSession()) return getDevLetters()
  const identity = await getCurrentUser()
  if (!identity?.isCloudAuthenticated || !userId) return []
  const result = await cloudbaseDb.from('letters').select('*')
    .eq('user_id', userId).order('created_at', { ascending: false })
  const letters = assertCloudResult(result, 'getLetters').map(normalizeCloudLetter)
  saveLetters(letters, false)
  return letters
}

export const getLetterById = async (letterId, userId) => {
  if (isDevSession()) {
    return getDevLetters().find((letter) => letter.id === letterId) || null
  }
  const identity = await getCurrentUser()
  if (!identity?.isCloudAuthenticated || !letterId || !userId) return null
  const result = await cloudbaseDb.from('letters').select('*')
    .eq('id', letterId).eq('user_id', userId).maybeSingle()
  const letter = assertCloudResult(result, 'getLetterById')
  return letter ? normalizeCloudLetter(letter) : null
}

export const hasEvent = async (eventKey, userId) => {
  if (getCachedLetters().some((letter) => (letter.eventKey || letter.id) === eventKey)) return true
  const identity = await getCurrentUser()
  if (!identity?.isCloudAuthenticated || !userId) return false
  const result = await cloudbaseDb.from('letters').select('id')
    .eq('user_id', userId).eq('event_key', eventKey).limit(1)
  return assertCloudResult(result, 'hasEvent').length > 0
}

export const createLetter = async ({
  userId,
  teaSpiritId = null,
  id,
  eventKey = id,
  type,
  createdAt = Date.now(),
  payload = {},
}) => {
  const identity = await getCurrentUser()
  if (!identity?.isCloudAuthenticated || !userId) {
    return createLocalLetter({ id: eventKey, eventKey, type, createdAt, payload })
  }
  if (await hasEvent(eventKey, userId)) return null
  const template = LETTER_TEMPLATES[type]
  if (!template) throw new Error(`Unknown letter type: ${type}`)
  const result = await cloudbaseDb.from('letters').insert({
    user_id: userId,
    tea_spirit_id: teaSpiritId,
    event_key: eventKey,
    type,
    title: template.title,
    image_url: template.imageUrl,
    payload,
    created_at: new Date(createdAt).toISOString(),
  }).select('*').single()
  const letter = normalizeCloudLetter(assertCloudResult(result, 'createLetter'))
  saveLetters([letter, ...getCachedLetters()].filter(
    (item, index, all) => all.findIndex((entry) => entry.id === item.id) === index,
  ))
  return letter
}

export const markLetterRead = async (id, userId) => {
  if (isDevSession()) return markDevLetterRead(id)
  const identity = await getCurrentUser()
  if (!identity?.isCloudAuthenticated || !userId) return markCachedLetterRead(id)
  try {
    const result = await cloudbaseDb.from('letters').update({
      read: true,
      read_at: new Date().toISOString(),
    }).eq('id', id).eq('user_id', userId).select('*').single()
    const letter = normalizeCloudLetter(assertCloudResult(result, 'markLetterRead'))
    markCachedLetterRead(id)
    return letter
  } catch (error) {
    console.error('Failed to mark cloud letter as read; updating cache only:', error)
    return markCachedLetterRead(id)
  }
}

export const getOrCreateObtainedAt = (now = Date.now()) => {
  const storedValue = Number(localStorage.getItem(SPIRIT_OBTAINED_AT_KEY))
  if (Number.isFinite(storedValue) && storedValue > 0) return storedValue

  localStorage.setItem(SPIRIT_OBTAINED_AT_KEY, String(now))
  return now
}

const toLocalDateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getPreviousDateKey = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() - 1)
  return toLocalDateKey(date)
}

export const evaluateHolidayLetterTriggers = (now = Date.now()) => {
  const today = new Date(now)
  const year = today.getFullYear()
  const todayKey = toLocalDateKey(today)
  const holidays = HOLIDAY_CONFIG[year]

  if (holidays?.midAutumn && todayKey === getPreviousDateKey(holidays.midAutumn)) {
    createLocalLetter({ id: `mid-autumn-${year}`, type: 'mid_autumn', createdAt: now })
  }

  if (
    holidays?.springFestival &&
    todayKey === getPreviousDateKey(holidays.springFestival)
  ) {
    createLocalLetter({
      id: `spring-festival-${year}`,
      type: 'spring_festival',
      createdAt: now,
    })
  }

  // Future backend flow:
  // event trigger -> create letter record -> save userId/openid -> attach coupon or
  // campaign payload -> send SMS/WeChat subscription -> open the matching letter.
  return getCachedLetters()
}

export const evaluateCloudHolidayLetterTriggers = async (userId, now = Date.now()) => {
  if (!userId) return getCachedLetters()
  const today = new Date(now)
  const year = today.getFullYear()
  const todayKey = toLocalDateKey(today)
  const holidays = HOLIDAY_CONFIG[year]

  if (holidays?.midAutumn && todayKey === getPreviousDateKey(holidays.midAutumn)) {
    await createLetter({
      userId,
      eventKey: `mid-autumn-${userId}-${year}`,
      type: 'mid_autumn',
      createdAt: now,
    })
  }
  if (holidays?.springFestival && todayKey === getPreviousDateKey(holidays.springFestival)) {
    await createLetter({
      userId,
      eventKey: `spring-festival-${userId}-${year}`,
      type: 'spring_festival',
      createdAt: now,
    })
  }
  return getLetters(userId)
}

export { SPIRIT_LIFETIME_MS }
