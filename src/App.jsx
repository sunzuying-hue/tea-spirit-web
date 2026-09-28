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

const pages = { elf: ElfPage, letters: LettersPage, my: MyPage }

function App() {
  const [targetLetterId] = useState(() => new URLSearchParams(window.location.search).get('letter'))
  const [hasEntered, setHasEntered] = useState(() => Boolean(targetLetterId))
  const [activeTab, setActiveTab] = useState(() => targetLetterId ? 'my' : 'elf')

  useEffect(() => {
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
  }, [])

  useEffect(() => {
    if (!targetLetterId) return
    const routeDeepLink = async () => {
      const identity = await getCurrentUser()
      setActiveTab(identity?.isCloudAuthenticated ? 'letters' : 'my')
    }
    routeDeepLink()
  }, [targetLetterId])

  if (!hasEntered) return <LaunchPage onEnter={() => setHasEntered(true)} />

  const ActivePage = pages[activeTab]
  const pageProps = activeTab === 'letters'
    ? { targetLetterId }
    : activeTab === 'my'
      ? {
          openPhoneLogin: Boolean(targetLetterId),
          onLoginComplete: () => setActiveTab(targetLetterId ? 'letters' : 'my'),
        }
      : {}
  return <div className="app-shell"><ActivePage {...pageProps} /><BottomTabs activeTab={activeTab} onChange={setActiveTab} /></div>
}

export default App
