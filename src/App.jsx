import { useEffect, useState } from 'react'
import BottomTabs from './components/BottomTabs'
import ElfPage from './pages/ElfPage'
import LaunchPage from './pages/LaunchPage'
import LettersPage from './pages/LettersPage'
import MyPage from './pages/MyPage'
import './App.css'
import {
  syncUserLifecycle,
} from './services/teaSpiritService'
import { getCurrentUser } from './services/authService'
import DevPanel from './dev/DevPanel'
import DevEntryChoice from './dev/DevEntryChoice'
import { endDevSession, startDevSession } from './dev/devSession'

const pages = { elf: ElfPage, letters: LettersPage, my: MyPage }

function App() {
  const [devEntryMode, setDevEntryMode] = useState(() => import.meta.env.DEV ? null : 'real')
  const [targetLetterId] = useState(() => new URLSearchParams(window.location.search).get('letter'))
  const [hasEntered, setHasEntered] = useState(() => Boolean(targetLetterId))
  const [activeTab, setActiveTab] = useState(() => targetLetterId ? 'my' : 'elf')
  const [highlightLettersTab, setHighlightLettersTab] = useState(false)

  useEffect(() => {
    if (!devEntryMode) return undefined
    const syncCloudData = async () => {
      try {
        await syncUserLifecycle()
      } catch (error) {
        console.error('[Lifecycle] completion failed', {
          code: error?.code || 'UNKNOWN',
          message: error?.message || 'Unknown error',
        })
      }
    }
    const lifecycleClock = window.setInterval(syncCloudData, 60 * 1000)

    syncCloudData()
    window.addEventListener('focus', syncCloudData)
    window.addEventListener('tea-spirit-auth-changed', syncCloudData)
    document.addEventListener('visibilitychange', syncCloudData)

    return () => {
      window.clearInterval(lifecycleClock)
      window.removeEventListener('focus', syncCloudData)
      window.removeEventListener('tea-spirit-auth-changed', syncCloudData)
      document.removeEventListener('visibilitychange', syncCloudData)
    }
  }, [devEntryMode])

  useEffect(() => {
    if (!devEntryMode || !targetLetterId) return
    const routeDeepLink = async () => {
      const identity = await getCurrentUser()
      setActiveTab(identity?.isCloudAuthenticated ? 'letters' : 'my')
    }
    routeDeepLink()
  }, [devEntryMode, targetLetterId])

  if (import.meta.env.DEV && !devEntryMode) {
    return (
      <DevEntryChoice
        onLocal={() => {
          startDevSession()
          setHasEntered(true)
          setActiveTab('elf')
          setDevEntryMode('local')
        }}
        onReal={() => {
          endDevSession()
          setHasEntered(true)
          setActiveTab('my')
          setDevEntryMode('real')
        }}
      />
    )
  }

  if (!hasEntered) return <LaunchPage onEnter={() => setHasEntered(true)} />

  const ActivePage = pages[activeTab]
  const pageProps = activeTab === 'letters'
    ? { targetLetterId }
    : activeTab === 'my'
      ? {
          openPhoneLogin: Boolean(targetLetterId),
          onLoginComplete: (profile) => setActiveTab(
            profile?.authProvider === 'dev' ? 'elf' : targetLetterId ? 'letters' : 'my',
          ),
        }
      : {
          onGuideLetterHighlight: () => {
            setHighlightLettersTab(false)
            window.requestAnimationFrame(() => setHighlightLettersTab(true))
            window.setTimeout(() => setHighlightLettersTab(false), 1300)
          },
        }
  return <div className="app-shell"><ActivePage {...pageProps} /><BottomTabs activeTab={activeTab} onChange={setActiveTab} highlightLetters={highlightLettersTab} />{import.meta.env.DEV && <DevPanel />}</div>
}

export default App
