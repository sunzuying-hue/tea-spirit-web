import { useEffect, useState } from 'react'
import launchBackground from '../assets/launch-bg.png'

function LaunchPage({ onEnter }) {
  const [hasScrolled, setHasScrolled] = useState(false)

  useEffect(() => {
    const updateScrollHint = () => setHasScrolled(window.scrollY > 40)
    updateScrollHint()
    window.addEventListener('scroll', updateScrollHint, { passive: true })
    return () => window.removeEventListener('scroll', updateScrollHint)
  }, [])

  return (
    <main className="launch-page">
      <img className="launch-image" src={launchBackground} alt="花涧茶寮开屏画面" />
      <button className="launch-enter-hotspot" type="button" onClick={onEnter} aria-label="进入茶寮" />
      <div className={`launch-scroll-hint${hasScrolled ? ' is-hidden' : ''}`} aria-hidden="true">
        <span>下滑进入花涧</span>
        <span className="launch-scroll-chevron">⌄</span>
      </div>
    </main>
  )
}

export default LaunchPage
