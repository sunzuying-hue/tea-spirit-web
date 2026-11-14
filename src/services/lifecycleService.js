import {
  evaluateHolidayLetterTriggers,
  getCachedLetters,
  getOrCreateObtainedAt,
  SPIRIT_LIFETIME_MS,
} from './letterService'
import { TEST_SPEED } from './teaSpiritService'

export const SPIRIT_STAGE_DURATION_MS = 2 * 60 * 60 * 1000

export const getSpiritStage = (obtainedAt, now = Date.now()) => {
  const elapsed = Math.max(0, now - obtainedAt) * TEST_SPEED
  if (elapsed >= SPIRIT_LIFETIME_MS) return 'complete'
  if (elapsed >= SPIRIT_STAGE_DURATION_MS * 2) return 'late'
  if (elapsed >= SPIRIT_STAGE_DURATION_MS) return 'mid'
  return 'early'
}

export const evaluateLetterTriggers = (now = Date.now()) => {
  getOrCreateObtainedAt(now)
  evaluateHolidayLetterTriggers(now)
  return getCachedLetters()
}
