import { useEffect, useState } from 'react'
import mailBackground from '../assets/mail-bg.png'
import {
  evaluateCloudHolidayLetterTriggers,
  getLetters,
  getLetterById,
  markLetterRead,
} from '../services/letterService'
import { getUserProfile } from '../services/userService'

const CONCEPT_LETTERS = [
  { id: 'concept-qixi', type: 'qixi', title: '七夕茶约', imageUrl: '/letters/qixi.png', read: true, concept: true },
  { id: 'concept-spring-festival', type: 'spring_festival', title: '春节来信', imageUrl: '/letters/spring-festival.png', read: true, concept: true },
  { id: 'concept-spirit-grown', type: 'spirit_grown', title: '茶灵长大啦', imageUrl: '/letters/spirit-grown.png', read: true, concept: true },
  { id: 'concept-mid-autumn', type: 'mid_autumn', title: '中秋来信', imageUrl: '/letters/mid-autumn.png', read: true, concept: true },
]

const withConceptLetters = (letters) => {
  const receivedTypes = new Set(letters.map((letter) => letter.type))
  return [...letters, ...CONCEPT_LETTERS.filter((letter) => !receivedTypes.has(letter.type))]
}

function LettersPage({ targetLetterId = null }) {
  const [letters, setLetters] = useState([])
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [targetStatus, setTargetStatus] = useState('')

  useEffect(() => {
    let active = true
    const refreshLetters = async () => {
      try {
        const profile = await getUserProfile()
        if (!active) return
        setUserId(profile.id)
        const cloudLetters = await evaluateCloudHolidayLetterTriggers(profile.id)
        if (targetLetterId) {
          const targetLetter = await getLetterById(targetLetterId, profile.id)
          if (!targetLetter) {
            setTargetStatus('该信笺不存在，或不属于当前账号。')
          } else {
            setTargetStatus('')
            window.requestAnimationFrame(() => {
              document.getElementById(`letter-${targetLetter.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            })
          }
        }
        setLetters(cloudLetters)
        setError('')
      } catch (loadError) {
        console.error('Failed to load letters:', loadError)
        if (active) {
          setLetters([])
          setError('网络好像开小差了，请稍后再试。')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    refreshLetters()
    window.addEventListener('tea-spirit-letters-changed', refreshLetters)
    window.addEventListener('tea-spirit-letters-refresh', refreshLetters)
    return () => {
      active = false
      window.removeEventListener('tea-spirit-letters-changed', refreshLetters)
      window.removeEventListener('tea-spirit-letters-refresh', refreshLetters)
    }
  }, [targetLetterId])

  const handleLetterClick = async (id) => {
    const selectedLetter = letters.find((letter) => letter.id === id)
    if (selectedLetter?.concept) return
    // 先在界面上立即呈现已读，让点击有即时反馈；数据仍按原逻辑写入并刷新。
    setLetters((current) => current.map((letter) =>
      letter.id === id ? { ...letter, read: true } : letter,
    ))
    await markLetterRead(id, userId)
    setLetters(await getLetters(userId))
  }

  return (
    <main className="main-page letters-page">
      <img className="page-background" src={mailBackground} alt="" />
      <section className="letters-list" aria-label="信笺列表">
        {loading && <p className="letters-status">正在读取信笺…</p>}
        {!loading && error && <p className="letters-status">{error}</p>}
        {!loading && targetStatus && <p className="letters-status">{targetStatus}</p>}
        {!loading && !error && !letters.length && <p className="letters-status is-empty">四时来信，静候相逢</p>}
        {withConceptLetters(letters).map((letter, index) => (
          <button
            className={`letter-card${letter.read ? ' is-read' : ''}${letter.concept ? ' is-concept' : ''}`}
            key={letter.id}
            id={`letter-${letter.id}`}
            type="button"
            disabled={letter.concept}
            style={{ '--letter-index': Math.min(index, 8) }}
            data-targeted={letter.id === targetLetterId ? 'true' : undefined}
            onClick={() => handleLetterClick(letter.id)}
            aria-label={`${letter.title}${letter.concept ? '，概念展示' : letter.read ? '，已读' : '，未读'}`}
          >
            <img src={letter.imageUrl} alt={letter.title} />
            <span className="letter-unread-dot" aria-hidden="true" />
          </button>
        ))}
      </section>
    </main>
  )
}

export default LettersPage
