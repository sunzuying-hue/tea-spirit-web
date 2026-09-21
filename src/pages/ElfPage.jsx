import teaBackground from '../assets/tea-bg.png'
import talkUi from '../assets/interaction-talk.png'
import waterUi from '../assets/interaction-water.png'
import sunUi from '../assets/interaction-sun.png'

function ElfPage() {
  const handleTalk = () => {
    console.log('talk')
  }

  const handleWater = () => {
    console.log('water')
  }

  const handleSun = () => {
    console.log('sun')
  }

  const actions = [
    { id: 'talk', label: '对话', image: talkUi, onClick: handleTalk },
    { id: 'water', label: '喝水', image: waterUi, onClick: handleWater },
    { id: 'sun', label: '阳光', image: sunUi, onClick: handleSun },
  ]

  return (
    <main className="main-page elf-page">
      <img className="page-background" src={teaBackground} alt="" />
      <section className="elf-actions" aria-label="茶灵互动">
        {actions.map((action) => (
          <button
            className="elf-action-button"
            key={action.id}
            type="button"
            aria-label={action.label}
            onClick={action.onClick}
          >
            <img src={action.image} alt="" />
          </button>
        ))}
      </section>
    </main>
  )
}

export default ElfPage
