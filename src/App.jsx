import { useState } from 'react'
import BottomTabs from './components/BottomTabs'
import ElfPage from './pages/ElfPage'
import LaunchPage from './pages/LaunchPage'
import LettersPage from './pages/LettersPage'
import MyPage from './pages/MyPage'
import './App.css'

const pages = { elf: ElfPage, letters: LettersPage, my: MyPage }

function App() {
  const [hasEntered, setHasEntered] = useState(false)
  const [activeTab, setActiveTab] = useState('elf')

  if (!hasEntered) return <LaunchPage onEnter={() => setHasEntered(true)} />

  const ActivePage = pages[activeTab]
  return <div className="app-shell"><ActivePage /><BottomTabs activeTab={activeTab} onChange={setActiveTab} /></div>
}

export default App
