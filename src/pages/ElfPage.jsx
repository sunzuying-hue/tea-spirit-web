import { useEffect, useRef, useState } from 'react'
import teaBackground from '../assets/tea-bg.png'
import talkUi from '../assets/interaction-talk.png'
import waterUi from '../assets/interaction-water.png'
import sunUi from '../assets/interaction-sun.png'
import onboarding01 from '../assets/onboarding/onboarding-01.png'
import onboarding02 from '../assets/onboarding/onboarding-02.png'
import onboarding03 from '../assets/onboarding/onboarding-03.png'
import onboarding04 from '../assets/onboarding/onboarding-04.png'
import onboarding05 from '../assets/onboarding/onboarding-05.png'
import onboarding06 from '../assets/onboarding/onboarding-06.png'
import onboarding07 from '../assets/onboarding/onboarding-07.png'
import onboarding08 from '../assets/onboarding/onboarding-08.png'
import { getSpiritStage } from '../services/lifecycleService'
import { getOrCreateObtainedAt } from '../services/letterService'
import { syncTeaSpiritLifecycle } from '../services/teaSpiritService'
import {
  calculateDevStage,
  hasSeenDevOnboarding,
  markDevOnboardingSeen,
} from '../dev/devDataStore'
import { isDevSession } from '../dev/devSession'

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

const ONBOARDING_KEY_PREFIX = 'teaSpiritOnboardingComplete:'
const GUIDE_MESSAGES = [
  '你来啦。',
  '接下来的六个小时，就请多关照啦。',
  '我会一点点长大。',
  '就算你先离开，我也会继续长大。',
  '想陪陪我的话，可以和我说说话。',
  '也可以给我喝水，或者陪我晒晒太阳。',
  '等我长大，就要回到花涧里啦。',
  '到时候，我会给你留一封信。',
]
const GUIDE_IMAGES = [
  onboarding01,
  onboarding02,
  onboarding03,
  onboarding04,
  onboarding05,
  onboarding06,
  onboarding07,
  onboarding08,
]

function ElfPage({ onGuideLetterHighlight }) {
  const videoRef = useRef(null)
  const initializedGuideSpirit = useRef(null)
  const [obtainedAt] = useState(() => getOrCreateObtainedAt())
  const [currentVideo, setCurrentVideo] = useState('idle')
  const [isInteracting, setIsInteracting] = useState(false)
  const [cloudSpirit, setCloudSpirit] = useState(null)
  const [lifecycleError, setLifecycleError] = useState('')
  const [isOnboarding, setIsOnboarding] = useState(false)
  const [guideStep, setGuideStep] = useState(0)
  const [guideReply, setGuideReply] = useState('')
  const [guideTransitioning, setGuideTransitioning] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [currentStage, setCurrentStage] = useState(() =>
    getSpiritStage(obtainedAt),
  )
  const currentVideoSrc =
    currentStage === 'complete' ? null : videos[currentStage][currentVideo]

  useEffect(() => {
    if (!cloudSpirit?.id || cloudSpirit.status === 'completed') return
    if (initializedGuideSpirit.current === cloudSpirit.id) return
    initializedGuideSpirit.current = cloudSpirit.id
    const hasCompletedGuide = isDevSession()
      ? hasSeenDevOnboarding(cloudSpirit.id)
      : localStorage.getItem(`${ONBOARDING_KEY_PREFIX}${cloudSpirit.id}`) === 'true'
    const isNewEarlySpirit = getSpiritStage(
      new Date(cloudSpirit.obtained_at).getTime(),
    ) === 'early'
    setGuideStep(0)
    setIsOnboarding(!hasCompletedGuide && isNewEarlySpirit)
  }, [cloudSpirit])

  useEffect(() => {
    const restartOnboarding = () => {
      if (!isDevSession() || !cloudSpirit || cloudSpirit.status === 'completed') return
      initializedGuideSpirit.current = cloudSpirit.id
      setGuideStep(0)
      setGuideReply('')
      setShowHelp(false)
      setIsOnboarding(true)
    }
    window.addEventListener('tea-spirit-onboarding-reset', restartOnboarding)
    return () => window.removeEventListener('tea-spirit-onboarding-reset', restartOnboarding)
  }, [cloudSpirit])

  useEffect(() => {
    const updateStage = () => {
      const sourceObtainedAt = cloudSpirit?.obtained_at
        ? new Date(cloudSpirit.obtained_at).getTime()
        : obtainedAt
      const stage = isDevSession()
        ? calculateDevStage(sourceObtainedAt, Date.now())
        : getSpiritStage(sourceObtainedAt, Date.now())
      if (
        !isDevSession() &&
        stage === 'complete' &&
        cloudSpirit?.id &&
        cloudSpirit.status !== 'completed'
      ) {
        void syncTeaSpiritLifecycle()
      }
      setCurrentStage(cloudSpirit?.status === 'completed'
        ? 'complete'
        : stage === 'middle' ? 'mid' : stage === 'completed' ? 'complete' : stage)
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
    if (!isDevSession()) return undefined
    const timer = window.setInterval(() => syncTeaSpiritLifecycle(), 1000)
    return () => window.clearInterval(timer)
  }, [])

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
    if (isOnboarding && (guideStep === 4 || guideStep === 5)) setGuideReply('谢谢你。')
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
    setGuideReply('')
  }

  const handleGuideAdvance = () => {
    if (!isOnboarding || guideReply || guideTransitioning) return
    setGuideTransitioning(true)
    window.setTimeout(() => {
      if (guideStep === GUIDE_MESSAGES.length - 1) {
        if (cloudSpirit?.id) {
          if (isDevSession()) markDevOnboardingSeen(cloudSpirit.id)
          else localStorage.setItem(`${ONBOARDING_KEY_PREFIX}${cloudSpirit.id}`, 'true')
        }
        setIsOnboarding(false)
        setGuideTransitioning(false)
        return
      }
      const nextStep = guideStep + 1
      setGuideStep(nextStep)
      setGuideTransitioning(false)
      if (nextStep === 6) onGuideLetterHighlight?.()
    }, 300)
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

  const guideContent = guideReply || GUIDE_MESSAGES[guideStep]

  return (
    <main
      className="main-page elf-page"
      onClick={isOnboarding ? handleGuideAdvance : undefined}
    >
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
      {isOnboarding && currentStage !== 'complete' && (
        <div
          className={`elf-guide-text-layer${
            guideStep === 4 ? ' is-talk-step' : guideStep === 5 ? ' is-care-step' : ''
          } is-guide-step-${guideStep + 1}${guideTransitioning ? ' is-switching' : ''}`}
          aria-live="polite"
          aria-label={guideContent}
        >
          <img
            className="elf-guide-image"
            src={GUIDE_IMAGES[guideStep]}
            alt={guideContent}
          />
        </div>
      )}
      {!isOnboarding && currentStage !== 'complete' && (
        <button
          className="elf-help-button"
          type="button"
          aria-label="查看玩法"
          onClick={() => setShowHelp((value) => !value)}
        >?</button>
      )}
      {showHelp && !isOnboarding && currentStage !== 'complete' && (
        <aside className="elf-help-bubble" aria-label="玩法说明">
          <p>陪我说说话、喝点水、晒晒太阳。<br />我会在六个小时里慢慢长大，<br />离开网页以后也不会停止。<br />长大后，我会给你留下一封信。</p>
          <button type="button" onClick={() => setShowHelp(false)} aria-label="关闭玩法说明">×</button>
        </aside>
      )}
      <section className="elf-actions" aria-label="茶灵互动">
        {actions.map((action) => (
          <button
            className={`elf-action-button${
              isOnboarding && (
                (guideStep === 4 && action.id === 'talk') ||
                (guideStep === 5 && (action.id === 'water' || action.id === 'sun'))
              ) ? ' is-guide-highlight' : ''
            }`}
            key={action.id}
            type="button"
            aria-label={action.label}
            onClick={(event) => {
              event.stopPropagation()
              action.onClick()
            }}
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
