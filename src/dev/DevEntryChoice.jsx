function DevEntryChoice({ onLocal, onReal }) {
  if (!import.meta.env.DEV) return null

  return (
    <main className="dev-entry-choice" aria-label="开发环境进入方式">
      <section className="dev-entry-card">
        <span>DEV</span>
        <h1>选择测试方式</h1>
        <p>本地测试不会读取或写入 CloudBase 数据。</p>
        <button type="button" onClick={onLocal}>本地测试进入</button>
        <button className="is-secondary" type="button" onClick={onReal}>使用真实账号登录</button>
      </section>
    </main>
  )
}

export default DevEntryChoice
