import { useEffect, useState } from 'react'
import mailBackground from '../assets/mail-bg.png'
import {
  getLetters,
  getLetterById,
  markLetterRead,
} from '../services/letterService'
import { getUserProfile } from '../services/userService'

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
        const cloudLetters = await getLetters(profile.id)
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
        {!loading && !letters.length && <p className="letters-status">还没有收到信笺</p>}
        {letters.map((letter) => (
          <button
            className={`letter-card${letter.read ? ' is-read' : ''}`}
            key={letter.id}
            id={`letter-${letter.id}`}
            type="button"
            data-targeted={letter.id === targetLetterId ? 'true' : undefined}
            onClick={() => handleLetterClick(letter.id)}
            aria-label={`${letter.title}${letter.read ? '，已读' : '，未读'}`}
          >
            <img src={letter.imageUrl} alt={letter.title} />
          </button>
        ))}
      </section>
    </main>
  )
}

export default LettersPage
