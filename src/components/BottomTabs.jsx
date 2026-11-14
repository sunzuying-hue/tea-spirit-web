import elfTab from '../assets/UI-elf.png'
import lettersTab from '../assets/UI-letters.png'
import myTab from '../assets/UI-my.png'

const tabs = [
  { id: 'elf', label: '茶灵', image: elfTab },
  { id: 'letters', label: '信笺', image: lettersTab },
  { id: 'my', label: '我的', image: myTab },
]

function BottomTabs({ activeTab, onChange, highlightLetters = false }) {
  return (
    <nav className="bottom-tabs" aria-label="主导航">
      {tabs.map((tab) => (
        <button
          className={`tab-button ${activeTab === tab.id ? 'is-active' : ''}${highlightLetters && tab.id === 'letters' ? ' is-guide-highlight' : ''}`}
          key={tab.id}
          type="button"
          aria-label={tab.label}
          aria-current={activeTab === tab.id ? 'page' : undefined}
          onClick={() => onChange(tab.id)}
        >
          <img src={tab.image} alt="" />
        </button>
      ))}
    </nav>
  )
}

export default BottomTabs
