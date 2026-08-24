interface NaverMapsLatLng {
  lat(): number
  lng(): number
}

interface NaverMapsMap {
  fitBounds(bounds: NaverMapsLatLngBounds, padding?: number | { top: number; right: number; bottom: number; left: number }): void
  setCenter(center: NaverMapsLatLng): void
}

interface NaverMapsLatLngBounds {
  extend(point: NaverMapsLatLng): void
}

interface NaverMapsMarker {
  setMap(map: NaverMapsMap | null): void
}

interface NaverMapsPolyline {
  setMap(map: NaverMapsMap | null): void
}

interface Window {
  naver?: {
    maps: {
      Map: new (element: HTMLElement, options: { center: NaverMapsLatLng; zoom: number }) => NaverMapsMap
      LatLng: new (lat: number, lng: number) => NaverMapsLatLng
      LatLngBounds: new () => NaverMapsLatLngBounds
      Marker: new (options: {
        map: NaverMapsMap
        position: NaverMapsLatLng
        title: string
        icon?: { content: string; anchor: { x: number; y: number } }
      }) => NaverMapsMarker
      Polyline: new (options: {
        map: NaverMapsMap
        path: NaverMapsLatLng[]
        strokeColor: string
        strokeWeight: number
        strokeOpacity: number
      }) => NaverMapsPolyline
      Point: new (x: number, y: number) => { x: number; y: number }
      Event: { addListener(target: NaverMapsMarker, eventName: 'click', handler: () => void): void }
      Service: {
        geocode(
          request: { query: string },
          callback: (status: string, response: { v2?: { addresses?: Array<{ x: string; y: string }> } }) => void,
        ): void
      }
      Status: { OK: string }
    }
  }
}
