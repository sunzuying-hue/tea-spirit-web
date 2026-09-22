import { useEffect, useRef, useState } from 'react'
import cloudbase from '@cloudbase/js-sdk'
import teaBackground from '../assets/tea-bg.png'
import talkUi from '../assets/interaction-talk.png'
import waterUi from '../assets/interaction-water.png'
import sunUi from '../assets/interaction-sun.png'

const cloudbaseApp = cloudbase.init({
  env: 'tea-spirit-web-d8g3tqcm207d21843',
})
const videoBucket = cloudbaseApp.storage.from('tea-spirit-web')

const getPublicVideoUrl = (path) => {
  const { data } = videoBucket.getPublicUrl(path)
  return data.publicUrl
}

const videos = {
  idle: getPublicVideoUrl('zaoqi-guaji.webm'),
  talk: getPublicVideoUrl('zaoqi-duihua.webm'),
  water: getPublicVideoUrl('zaoqi-heshui.webm'),
  sun: getPublicVideoUrl('zaoqi-yangguang.webm'),
}

function ElfPage() {
  const videoRef = useRef(null)
  const [currentVideo, setCurrentVideo] = useState('idle')
  const [isInteracting, setIsInteracting] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.load()
    const playPromise = video.play()
    if (playPromise) {
      playPromise.catch(() => {
        // Muted autoplay can still be blocked by browser or device policy.
      })
    }
  }, [currentVideo])

  const startInteraction = (videoName) => {
    if (isInteracting) return
    setIsInteracting(true)
    setCurrentVideo(videoName)
  }

  const handleTalk = () => {
    startInteraction('talk')
  }

  const handleWater = () => {
    startInteraction('water')
  }

  const handleSun = () => {
    startInteraction('sun')
  }

  const handleVideoEnded = () => {
    if (currentVideo === 'idle') return
    setCurrentVideo('idle')
    setIsInteracting(false)
  }

  const actions = [
    { id: 'talk', label: '对话', image: talkUi, onClick: handleTalk },
    { id: 'water', label: '喝水', image: waterUi, onClick: handleWater },
    { id: 'sun', label: '阳光', image: sunUi, onClick: handleSun },
  ]

  return (
    <main className="main-page elf-page">
      <img className="page-background" src={teaBackground} alt="" />
      <video
        ref={videoRef}
        className="elf-video"
        src={videos[currentVideo]}
        autoPlay
        muted
        playsInline
        preload="auto"
        loop={currentVideo === 'idle'}
        onEnded={handleVideoEnded}
        aria-label="茶灵"
      />
      <section className="elf-actions" aria-label="茶灵互动">
        {actions.map((action) => (
          <button
            className="elf-action-button"
            key={action.id}
            type="button"
            aria-label={action.label}
            onClick={action.onClick}
            disabled={isInteracting}
          >
            <img src={action.image} alt="" />
          </button>
        ))}
      </section>
    </main>
  )
}

export default ElfPage
