import { useState } from 'react'
import {
  clearDevLetters,
  clearDevOnboarding,
  DEV_TEST_SPEED,
  resetDevCompanionCount,
  resetDevData,
  setDevStage,
} from './devDataStore'
import { isDevSession } from './devSession'

function DevPanel() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')

  if (!import.meta.env.DEV || !isDevSession()) return null

  const run = (label, action) => {
    action()
    setMessage(label)
  }

  return (
    <aside className={`dev-panel${open ? ' is-open' : ''}`} aria-label="本地测试工具">
      <button className="dev-panel-toggle" type="button" onClick={() => setOpen((value) => !value)}>
        DEV
      </button>
      {open && (
        <div className="dev-panel-body">
          <strong>本地测试 ×{DEV_TEST_SPEED}</strong>
          <div className="dev-panel-grid">
            <button type="button" onClick={() => run('已重置全部测试数据', resetDevData)}>重置本地测试</button>
            <button type="button" onClick={() => run('已回到 early', () => setDevStage('early'))}>跳到 early</button>
            <button type="button" onClick={() => run('已进入 middle', () => setDevStage('middle'))}>跳到 middle</button>
            <button type="button" onClick={() => run('已进入 late', () => setDevStage('late'))}>跳到 late</button>
            <button type="button" onClick={() => run('已进入 completed', () => setDevStage('completed'))}>跳到 completed</button>
            <button type="button" onClick={() => run('首次引导已恢复', clearDevOnboarding)}>重新看首次引导</button>
            <button type="button" onClick={() => run('测试信笺已清空', clearDevLetters)}>清空测试信笺</button>
            <button type="button" onClick={() => run('陪伴次数已归零', resetDevCompanionCount)}>陪伴次数归零</button>
          </div>
          {message && <small>{message}</small>}
        </div>
      )}
    </aside>
  )
}

export default DevPanel
