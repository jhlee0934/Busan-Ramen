import { NaverMap } from './features/maps/NaverMap'
import { loadRestaurants } from './features/restaurants/data'

function App() {
  if (window.location.pathname !== '/') {
    return <main className="not-found"><p className="eyebrow">404</p><h1>페이지를 찾을 수 없습니다.</h1><a href="/">부산 라멘 지도로 돌아가기</a></main>
  }
  const restaurantData = loadRestaurants()

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">麺</div>
        <div>
          <p className="app-kicker">BUSAN RAMEN MAP</p>
          <h1>부산 라멘 지도</h1>
          <p className="app-description">갤러리 후기의 메뉴와 맛 평가를 지도에서 확인하세요.</p>
        </div>
      </header>
      {restaurantData.status === 'ready'
        ? <NaverMap restaurants={restaurantData.restaurants} />
        : <p role="alert">매장 데이터를 불러오지 못했습니다.</p>}
    </main>
  )
}

export default App
