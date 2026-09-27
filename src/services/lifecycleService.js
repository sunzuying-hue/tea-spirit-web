import {
  createLetter,
  evaluateHolidayLetterTriggers,
  getLetters,
  getOrCreateObtainedAt,
  SPIRIT_LIFETIME_MS,
} from './letterService'
import { incrementCompanionCount } from './userService'

export const LIFECYCLE_EVENTS_STORAGE_KEY = 'teaSpiritLifecycleEvents'
export const SPIRIT_STAGE_DURATION_MS = 2 * 60 * 60 * 1000

export const getSpiritStage = (obtainedAt, now = Date.now()) => {
  const elapsed = Math.max(0, now - obtainedAt)
  if (elapsed >= SPIRIT_LIFETIME_MS) return 'complete'
  if (elapsed >= SPIRIT_STAGE_DURATION_MS * 2) return 'late'
  if (elapsed >= SPIRIT_STAGE_DURATION_MS) return 'mid'
  return 'early'
}

const getHandledEvents = () => {
  try {
    const events = JSON.parse(localStorage.getItem(LIFECYCLE_EVENTS_STORAGE_KEY) || '[]')
    return Array.isArray(events) ? events : []
  } catch (error) {
    console.error('Failed to read tea spirit lifecycle events:', error)
    return []
  }
}

const rememberHandledEvent = (eventKey) => {
  const events = getHandledEvents()
  if (events.includes(eventKey)) return
  localStorage.setItem(
    LIFECYCLE_EVENTS_STORAGE_KEY,
    JSON.stringify([...events, eventKey]),
  )
}

export const handleSpiritMatured = (obtainedAt, now = Date.now()) => {
  const eventKey = `spirit-grown-${obtainedAt}`
  if (getHandledEvents().includes(eventKey)) return false

  createLetter({
    id: eventKey,
    type: 'spirit_grown',
    createdAt: now,
  })
  incrementCompanionCount()
  rememberHandledEvent(eventKey)
  return true
}

export const evaluateLetterTriggers = (now = Date.now()) => {
  const obtainedAt = getOrCreateObtainedAt(now)

  if (now - obtainedAt >= SPIRIT_LIFETIME_MS) {
    handleSpiritMatured(obtainedAt, now)
  }

  evaluateHolidayLetterTriggers(now)
  return getLetters()
}
