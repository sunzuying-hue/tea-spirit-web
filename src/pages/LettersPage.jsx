import { useEffect, useState } from 'react'
import mailBackground from '../assets/mail-bg.png'
import {
  getLetters,
  markLetterRead,
} from '../services/letterService'
import { evaluateLetterTriggers } from '../services/lifecycleService'

function LettersPage() {
  const [letters, setLetters] = useState(() => getLetters())

  useEffect(() => {
    const refreshLetters = () => setLetters(evaluateLetterTriggers())
    refreshLetters()
    window.addEventListener('tea-spirit-letters-changed', refreshLetters)
    return () => window.removeEventListener('tea-spirit-letters-changed', refreshLetters)
  }, [])

  const handleLetterClick = (id) => {
    markLetterRead(id)
    setLetters(getLetters())
  }

  return (
    <main className="main-page letters-page">
      <img className="page-background" src={mailBackground} alt="" />
      <section className="letters-list" aria-label="信笺列表">
        {letters.map((letter) => (
          <button
            className={`letter-card${letter.read ? ' is-read' : ''}`}
            key={letter.id}
            type="button"
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
