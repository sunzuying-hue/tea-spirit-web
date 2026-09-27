export const LETTERS_STORAGE_KEY = 'teaSpiritLetters'
export const SPIRIT_OBTAINED_AT_KEY = 'teaSpiritObtainedAt'

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
    title: '茶灵来信',
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

const saveLetters = (letters) => {
  localStorage.setItem(LETTERS_STORAGE_KEY, JSON.stringify(letters))
  window.dispatchEvent(new CustomEvent('tea-spirit-letters-changed'))
}

export const getLetters = () =>
  readStoredLetters().sort((a, b) => b.createdAt - a.createdAt)

export const createLetter = ({ id, type, createdAt = Date.now(), payload = {} }) => {
  const letters = readStoredLetters()
  if (letters.some((letter) => letter.id === id)) return null

  const template = LETTER_TEMPLATES[type]
  if (!template) throw new Error(`Unknown letter type: ${type}`)

  const letter = {
    id,
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

export const markLetterRead = (id) => {
  const letters = readStoredLetters()
  const nextLetters = letters.map((letter) =>
    letter.id === id ? { ...letter, read: true } : letter,
  )
  saveLetters(nextLetters)
  return nextLetters.find((letter) => letter.id === id) || null
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
    createLetter({ id: `mid-autumn-${year}`, type: 'mid_autumn', createdAt: now })
  }

  if (
    holidays?.springFestival &&
    todayKey === getPreviousDateKey(holidays.springFestival)
  ) {
    createLetter({
      id: `spring-festival-${year}`,
      type: 'spring_festival',
      createdAt: now,
    })
  }

  // Future backend flow:
  // event trigger -> create letter record -> save userId/openid -> attach coupon or
  // campaign payload -> send SMS/WeChat subscription -> open the matching letter.
  return getLetters()
}

export { SPIRIT_LIFETIME_MS }
