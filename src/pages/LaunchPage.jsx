import launchBackground from '../assets/launch-bg.png'

function LaunchPage({ onEnter }) {
  return (
    <main className="launch-page">
      <img className="launch-image" src={launchBackground} alt="花涧茶寮开屏画面" />
      <button className="launch-enter-hotspot" type="button" onClick={onEnter} aria-label="进入茶寮" />
    </main>
  )
}

export default LaunchPage
