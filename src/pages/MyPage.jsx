import { useEffect, useRef, useState } from 'react'
import {
  getCachedUserProfile,
  getUserProfile,
} from '../services/userService'
import {
  getCurrentUser,
  sendPhoneVerificationCode,
  signInWithPhoneVerificationCode,
  subscribeToAuthChanges,
} from '../services/authService'

const PROFILE_MEMORY_IMAGE = '/profile/tea-spirit-memory.jpg'
const PROFILE_POEM_IMAGE = '/profile/tea-poem.png'
const LOGIN_PANEL_CLOSE_MS = 200
const AUTH_PROVIDER_LABELS = { phone: '手机号', dev: '本地', wechat: '微信', apple: 'Apple' }

const formatVisitDate = (timestamp) => {
  if (!timestamp) return '——'
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}年${month}月${day}日`
}

function UserInfoCard({ userProfile, onLogin, loading }) {
  const isLoggedIn = userProfile.authStatus === 'authenticated' || userProfile.authProvider === 'dev'
  const hasProfileError = userProfile.profileStatus === 'error'

  return (
    <section className="my-user-info" aria-label="用户信息">
      <img
        className="my-avatar"
        src={userProfile.avatarUrl}
        alt={isLoggedIn ? `${userProfile.nickname}的头像` : '默认茶灵头像'}
      />
      <div className="my-user-copy">
        <strong>{userProfile.nickname}</strong>
        <button type="button" onClick={onLogin} disabled={isLoggedIn || loading}>
          {isLoggedIn
            ? hasProfileError
              ? '已登录，资料加载失败'
              : `已登录（${AUTH_PROVIDER_LABELS[userProfile.authProvider] || userProfile.authProvider || '本地'}）`
            : '手机号登录'}
        </button>
        <p>初次到访：<span>{formatVisitDate(userProfile.firstVisitAt)}</span></p>
      </div>
    </section>
  )
}

function PhoneLoginPanel({ onSuccess, onCancel, closing = false }) {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [sending, setSending] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!countdown) return undefined
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [countdown])

  const handleSendCode = async () => {
    setSending(true)
    setError('')
    try {
      const result = await sendPhoneVerificationCode(phone)
      if (!result.success) return setError(result.error)
      setCountdown(60)
    } catch (sendError) {
      console.error('Failed to send phone verification code:', sendError)
      setError('验证码发送失败，请稍后重试。')
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoggingIn(true)
    setError('')
    try {
      const result = await signInWithPhoneVerificationCode(phone, code)
      if (!result.success) return setError(result.error)
      await onSuccess()
    } catch (loginError) {
      console.error('Phone sign-in failed:', loginError)
      setError('登录失败，请检查验证码后重试。')
    } finally {
      setLoggingIn(false)
    }
  }

  return (
    <div
      className={`phone-login-backdrop${closing ? ' is-closing' : ''}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
    <form className="phone-login-panel" onSubmit={handleSubmit} aria-label="手机号登录">
      <button className="phone-login-close" type="button" onClick={onCancel} aria-label="关闭登录">×</button>
      <strong>手机号登录</strong>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="请输入手机号"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
      />
      <div className="phone-code-row">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="验证码"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <button type="button" onClick={handleSendCode} disabled={sending || countdown > 0}>
          {sending ? '发送中…' : countdown > 0 ? `${countdown}秒` : '获取验证码'}
        </button>
      </div>
      <button type="submit" disabled={loggingIn || !phone || !code}>
        {loggingIn ? '登录中…' : '登录'}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
    </div>
  )
}

function CompanionCard({ count }) {
  return (
    <section className="my-companion" aria-label="茶灵陪伴次数">
      茶灵陪伴：<strong key={count}>{count}</strong>次
    </section>
  )
}

function MemoryPhotoCard() {
  return (
    <section className="my-memory" aria-label="茶灵回忆">
      <img src={PROFILE_MEMORY_IMAGE} alt="茶灵回忆" />
      <img
        className="my-poem-image"
        src={PROFILE_POEM_IMAGE}
        alt="松花酿酒，春水煎茶——《人月圆·山中书事》张可久"
      />
    </section>
  )
}

function MyPage({ openPhoneLogin = false, onLoginComplete }) {
  const [userProfile, setUserProfile] = useState(() => getCachedUserProfile())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showPhoneLogin, setShowPhoneLogin] = useState(openPhoneLogin)
  const [loginClosing, setLoginClosing] = useState(false)
  const loginCloseTimer = useRef(null)

  useEffect(() => () => window.clearTimeout(loginCloseTimer.current), [])

  const closePhoneLogin = () => {
    if (!showPhoneLogin || loginClosing) return
    setLoginClosing(true)
    window.clearTimeout(loginCloseTimer.current)
    loginCloseTimer.current = window.setTimeout(() => {
      setShowPhoneLogin(false)
      setLoginClosing(false)
    }, LOGIN_PANEL_CLOSE_MS)
  }

  useEffect(() => {
    const refreshProfile = async () => {
      try {
        const profile = await getUserProfile()
        setUserProfile(profile)
        setError(profile.profileStatus === 'error'
          ? '网络好像开小差了，请稍后再试。'
          : '')
        if (import.meta.env.DEV) console.info('[MyPage] profile updated')
      } catch (loadError) {
        console.error('Failed to load user profile:', loadError)
        setError('网络好像开小差了，请稍后再试。')
      } finally {
        setLoading(false)
      }
    }
    refreshProfile()
    const unsubscribeAuth = subscribeToAuthChanges(refreshProfile)
    window.addEventListener('tea-spirit-user-refresh', refreshProfile)
    return () => {
      unsubscribeAuth()
      window.removeEventListener('tea-spirit-user-refresh', refreshProfile)
    }
  }, [])

  const handleLogin = () => setShowPhoneLogin(true)

  const handlePhoneLoginSuccess = async () => {
    setLoading(true)
    const authUser = await getCurrentUser()
    if (!authUser?.authUid) {
      setError('验证码已提交，但没有取得有效登录状态。')
      setLoading(false)
      return
    }
    const profile = await getUserProfile()
    setUserProfile(profile)
    if (import.meta.env.DEV) console.info('[MyPage] profile updated')
    closePhoneLogin()
    setError(profile.profileStatus === 'error'
      ? '网络好像开小差了，请稍后再试。'
      : '')
    setLoading(false)
    onLoginComplete?.(profile)
  }

  return (
    <main className="main-page my-page" aria-label="我的">
      <div className="my-page-canvas">
        <img
          className="my-layout-art"
          src="/profile/my-page-reference.png"
          alt=""
        />
        <UserInfoCard
          userProfile={userProfile}
          onLogin={handleLogin}
          loading={loading}
        />
        {loading && <p className="my-data-status">正在读取资料…</p>}
        {error && <p className="my-data-status">{error}</p>}
        {showPhoneLogin && (
          <PhoneLoginPanel
            onSuccess={handlePhoneLoginSuccess}
            onCancel={closePhoneLogin}
            closing={loginClosing}
          />
        )}
        <CompanionCard count={userProfile.companionCount} />
        <MemoryPhotoCard />
      </div>
    </main>
  )
}

export default MyPage
