import { useEffect, useRef, useState } from 'react'
import launchBackground from '../assets/launch-bg.png'

const LEAVE_DURATION_MS = 620

function LaunchPage({ onEnter }) {
  const [hasScrolled, setHasScrolled] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const leaveTimer = useRef(null)

  useEffect(() => {
    const updateScrollHint = () => setHasScrolled(window.scrollY > 40)
    updateScrollHint()
    window.addEventListener('scroll', updateScrollHint, { passive: true })
    return () => {
      window.removeEventListener('scroll', updateScrollHint)
      window.clearTimeout(leaveTimer.current)
    }
  }, [])

  const handleEnter = () => {
    if (isLeaving) return
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      onEnter()
      return
    }
    setIsLeaving(true)
    leaveTimer.current = window.setTimeout(() => {
      window.scrollTo(0, 0)
      onEnter()
    }, LEAVE_DURATION_MS)
  }

  return (
    <main className={`launch-page${isLeaving ? ' is-leaving' : ''}`}>
      <img className="launch-image" src={launchBackground} alt="花涧茶寮开屏画面" />
      <button className="launch-enter-hotspot" type="button" onClick={handleEnter} aria-label="进入茶寮" />
      <div className={`launch-scroll-hint${hasScrolled || isLeaving ? ' is-hidden' : ''}`} aria-hidden="true">
        <span>下滑进入花涧</span>
        <span className="launch-scroll-chevron">⌄</span>
      </div>
    </main>
  )
}

export default LaunchPage
