import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { initAmplitude } from './lib/amplitude.js'
import './index.css'

// Amplitude Analytics + Experiment 초기화 (앱 마운트 전에 1회)
initAmplitude()

// GitHub Pages 서브경로(/repo/) 대응 — Vite 의 BASE_URL 을 라우터 basename 으로 사용
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
