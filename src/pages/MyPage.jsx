import { useEffect, useState } from 'react'
import {
  getUserProfile,
  loginWithWeChat,
} from '../services/userService'

const PROFILE_MEMORY_IMAGE = '/profile/tea-spirit-memory.jpg'
const PROFILE_POEM_IMAGE = '/profile/tea-poem.png'

const formatVisitDate = (timestamp) => {
  if (!timestamp) return '——'
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}年${month}月${day}日`
}

function UserInfoCard({ userProfile, onLogin }) {
  const isLoggedIn = Boolean(userProfile.userId)

  return (
    <section className="my-user-info" aria-label="用户信息">
      <img
        className="my-avatar"
        src={userProfile.avatarUrl}
        alt={isLoggedIn ? `${userProfile.nickname}的头像` : '默认茶灵头像'}
      />
      <div className="my-user-copy">
        <strong>{userProfile.nickname}</strong>
        <button type="button" onClick={onLogin} disabled={isLoggedIn}>
          {isLoggedIn ? '已登录（本地模拟）' : '微信登录'}
        </button>
        <p>初次到访：<span>{formatVisitDate(userProfile.firstVisitAt)}</span></p>
      </div>
    </section>
  )
}

function CompanionCard({ count }) {
  return (
    <section className="my-companion" aria-label="茶灵陪伴次数">
      茶灵陪伴：<strong>{count}</strong>次
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

function MyPage() {
  const [userProfile, setUserProfile] = useState(() => getUserProfile())

  useEffect(() => {
    const refreshProfile = () => setUserProfile(getUserProfile())
    window.addEventListener('tea-spirit-user-changed', refreshProfile)
    return () => window.removeEventListener('tea-spirit-user-changed', refreshProfile)
  }, [])

  const handleLogin = async () => {
    const profile = await loginWithWeChat()
    setUserProfile(profile)
  }

  return (
    <main className="main-page my-page" aria-label="我的">
      <div className="my-page-canvas">
        <img
          className="my-layout-art"
          src="/profile/my-page-reference.png"
          alt=""
        />
        <UserInfoCard userProfile={userProfile} onLogin={handleLogin} />
        <CompanionCard count={userProfile.companionCount} />
        <MemoryPhotoCard />
      </div>
    </main>
  )
}

export default MyPage
