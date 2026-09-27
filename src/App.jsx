import { useEffect, useState } from 'react'
import BottomTabs from './components/BottomTabs'
import ElfPage from './pages/ElfPage'
import LaunchPage from './pages/LaunchPage'
import LettersPage from './pages/LettersPage'
import MyPage from './pages/MyPage'
import './App.css'
import {
  evaluateLetterTriggers,
} from './services/lifecycleService'
import {
  getOrCreateObtainedAt,
  SPIRIT_LIFETIME_MS,
} from './services/letterService'

const pages = { elf: ElfPage, letters: LettersPage, my: MyPage }

function App() {
  const [hasEntered, setHasEntered] = useState(false)
  const [activeTab, setActiveTab] = useState('elf')

  useEffect(() => {
    const evaluate = () => evaluateLetterTriggers(Date.now())
    const obtainedAt = getOrCreateObtainedAt()
    const remaining = SPIRIT_LIFETIME_MS - (Date.now() - obtainedAt)
    const maturityTimer = remaining > 0 ? window.setTimeout(evaluate, remaining) : null

    evaluate()
    window.addEventListener('focus', evaluate)
    document.addEventListener('visibilitychange', evaluate)

    return () => {
      if (maturityTimer) window.clearTimeout(maturityTimer)
      window.removeEventListener('focus', evaluate)
      document.removeEventListener('visibilitychange', evaluate)
    }
  }, [])

  if (!hasEntered) return <LaunchPage onEnter={() => setHasEntered(true)} />

  const ActivePage = pages[activeTab]
  return <div className="app-shell"><ActivePage /><BottomTabs activeTab={activeTab} onChange={setActiveTab} /></div>
}

export default App
