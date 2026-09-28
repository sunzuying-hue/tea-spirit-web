import { useEffect, useRef, useState } from 'react'
import teaBackground from '../assets/tea-bg.png'
import talkUi from '../assets/interaction-talk.png'
import waterUi from '../assets/interaction-water.png'
import sunUi from '../assets/interaction-sun.png'
import { getSpiritStage } from '../services/lifecycleService'
import { getOrCreateObtainedAt } from '../services/letterService'
import { syncTeaSpiritLifecycle } from '../services/teaSpiritService'

const videos = {
  early: {
    idle: '/videos/zaoqi/zaoqi-guaji.mp4',
    talk: '/videos/zaoqi/zaoqi-duihua.mp4',
    water: '/videos/zaoqi/zaoqi-heshui.mp4',
    sun: '/videos/zaoqi/zaoqi-yangguang.mp4',
  },
  mid: {
    idle: '/videos/zhongqi/zhongqi-guaji.mp4',
    talk: '/videos/zhongqi/zhongqi-duihua.mp4',
    water: '/videos/zhongqi/zhongqi-heshui.mp4',
    sun: '/videos/zhongqi/zhongqi-yangguang.mp4',
  },
  late: {
    idle: '/videos/houqi/houqi-guaji.mp4',
    talk: '/videos/houqi/houqi-duihua.mp4',
    water: '/videos/houqi/houqi-heshui.mp4',
    sun: '/videos/houqi/houqi-yangguang.mp4',
  },
}

function ElfPage() {
  const videoRef = useRef(null)
  const [obtainedAt] = useState(() => getOrCreateObtainedAt())
  const [currentVideo, setCurrentVideo] = useState('idle')
  const [isInteracting, setIsInteracting] = useState(false)
  const [cloudSpirit, setCloudSpirit] = useState(null)
  const [lifecycleError, setLifecycleError] = useState('')
  const [currentStage, setCurrentStage] = useState(() =>
    getSpiritStage(obtainedAt),
  )
  const currentVideoSrc =
    currentStage === 'complete' ? null : videos[currentStage][currentVideo]

  useEffect(() => {
    const updateStage = () => {
      const sourceObtainedAt = cloudSpirit?.obtained_at
        ? new Date(cloudSpirit.obtained_at).getTime()
        : obtainedAt
      setCurrentStage(cloudSpirit?.status === 'completed'
        ? 'complete'
        : getSpiritStage(sourceObtainedAt, Date.now()))
    }
    const stageClock = window.setInterval(updateStage, 60 * 1000)

    updateStage()
    window.addEventListener('focus', updateStage)
    document.addEventListener('visibilitychange', updateStage)

    return () => {
      window.clearInterval(stageClock)
      window.removeEventListener('focus', updateStage)
      document.removeEventListener('visibilitychange', updateStage)
    }
  }, [cloudSpirit, obtainedAt])

  useEffect(() => {
    let active = true
    const refreshSpirit = async () => {
      try {
        const spirit = await syncTeaSpiritLifecycle()
        if (active && spirit) {
          setCloudSpirit(spirit)
          setLifecycleError('')
        }
      } catch {
        if (active) {
          setLifecycleError('网络好像开小差了，成长状态稍后会自动重试。')
        }
      }
    }
    const handleCloudChange = (event) => {
      if (!active) return
      setCloudSpirit(event.detail?.spirit || null)
      setLifecycleError('')
    }
    const handleLifecycleError = () => {
      if (!active) return
      setLifecycleError('网络好像开小差了，成长状态稍后会自动重试。')
    }
    refreshSpirit()
    window.addEventListener('tea-spirit-cloud-changed', handleCloudChange)
    window.addEventListener('tea-spirit-lifecycle-error', handleLifecycleError)
    return () => {
      active = false
      window.removeEventListener('tea-spirit-cloud-changed', handleCloudChange)
      window.removeEventListener('tea-spirit-lifecycle-error', handleLifecycleError)
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || currentStage === 'complete') return

    video.load()
    const playPromise = video.play()
    if (playPromise) {
      playPromise.catch(() => {
        // Muted autoplay can still be blocked by browser or device policy.
      })
    }
  }, [currentStage, currentVideo])

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

  const handleVideoLoadedData = (event) => {
    console.info('Tea spirit video loaded:', event.currentTarget.currentSrc)
  }

  const handleVideoPlay = (event) => {
    console.info('Tea spirit video playing:', event.currentTarget.currentSrc)
  }

  const handleVideoError = (event) => {
    const mediaError = event.currentTarget.error
    console.error('Tea spirit video failed:', {
      src: event.currentTarget.currentSrc || currentVideoSrc,
      code: mediaError?.code,
      message: mediaError?.message,
    })
  }

  const actions = [
    { id: 'talk', label: '对话', image: talkUi, onClick: handleTalk },
    { id: 'water', label: '喝水', image: waterUi, onClick: handleWater },
    { id: 'sun', label: '阳光', image: sunUi, onClick: handleSun },
  ]

  return (
    <main className="main-page elf-page">
      <img className="page-background" src={teaBackground} alt="" />
      {currentStage !== 'complete' && (
        <div className="elf-video-frame">
        <video
          ref={videoRef}
          className="elf-video"
          src={currentVideoSrc}
          autoPlay
          muted
          playsInline
          preload="auto"
          loop={currentVideo === 'idle'}
          onLoadedData={handleVideoLoadedData}
          onPlay={handleVideoPlay}
          onEnded={handleVideoEnded}
          onError={handleVideoError}
          aria-label={`${currentStage}阶段茶灵`}
        />
        </div>
      )}
      {currentStage === 'complete' && (
        <p className="elf-lifecycle-status">茶灵已经回到自然中。</p>
      )}
      {lifecycleError && (
        <p className="elf-lifecycle-status is-error">{lifecycleError}</p>
      )}
      <section className="elf-actions" aria-label="茶灵互动">
        {actions.map((action) => (
          <button
            className="elf-action-button"
            key={action.id}
            type="button"
            aria-label={action.label}
            onClick={action.onClick}
            disabled={isInteracting || currentStage === 'complete'}
          >
            <img src={action.image} alt="" />
          </button>
        ))}
      </section>
    </main>
  )
}

export default ElfPage
