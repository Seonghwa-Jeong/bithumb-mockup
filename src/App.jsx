import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { MarketProvider } from './context/MarketContext.jsx'
import Header from './components/Header.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Market from './pages/Market.jsx'
import Exchange from './pages/Exchange.jsx'
import Portfolio from './pages/Portfolio.jsx'
import Orders from './pages/Orders.jsx'
import Wallet from './pages/Wallet.jsx'
import DevTools from './components/DevTools.jsx'

function RequireAuth({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

// 페이지 조회(Page Viewed)는 Amplitude 오토캡쳐가 담당합니다. (autocapture.pageViews)
function Shell() {
  const location = useLocation()
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup'
  return (
    <>
      {!isAuthPage && <Header />}
      <main className={isAuthPage ? 'app-main auth-main' : 'app-main'}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<Navigate to="/market" replace />} />
          {/* 거래소 시세·코인 차트는 비로그인 공개 (실제 빗썸과 동일) */}
          <Route path="/market" element={<Market />} />
          <Route path="/trade/:symbol" element={<Exchange />} />
          <Route
            path="/portfolio"
            element={
              <RequireAuth>
                <Portfolio />
              </RequireAuth>
            }
          />
          <Route
            path="/orders"
            element={
              <RequireAuth>
                <Orders />
              </RequireAuth>
            }
          />
          <Route
            path="/wallet"
            element={
              <RequireAuth>
                <Wallet />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/market" replace />} />
        </Routes>
      </main>
      <DevTools />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <MarketProvider>
        <Shell />
      </MarketProvider>
    </AuthProvider>
  )
}
