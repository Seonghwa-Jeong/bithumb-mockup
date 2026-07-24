import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMarket } from '../context/MarketContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { COIN_MAP } from '../lib/market.js'
import { formatPrice, formatPct, formatVolume } from '../lib/format.js'
import { track, getPayload } from '../lib/amplitude.js'
import Sparkline from '../components/Sparkline.jsx'

const SORTS = [
  { key: 'name', label: '이름' },
  { key: 'price', label: '현재가' },
  { key: 'changePct', label: '변동률' },
  { key: 'volume24', label: '거래대금' },
]

export default function Market() {
  const { coins, tickers } = useMarket()
  const { user } = useAuth()
  const navigate = useNavigate()

  // Remote config: 비로그인 랜딩 히어로 배너 문구/CTA 를 원격 제어
  const hero = getPayload('market-hero', {
    eyebrow: 'No.1 디지털 자산 거래소',
    title: '대한민국 대표 디지털 자산 거래소, bithumb',
    body: '로그인 없이 실시간 시세를 먼저 둘러보세요. 지금 가입하면 실습용 원화 1,000,000원을 드려요.',
    cta: '회원가입하고 시작하기',
  })
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: 'volume24', dir: 'desc' })
  const [favorites, setFavorites] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('bithumb_favs')) || [])
    } catch {
      return new Set()
    }
  })
  const [tab, setTab] = useState('all') // all | fav

  function toggleFav(symbol, e) {
    e.stopPropagation()
    setFavorites((prev) => {
      const next = new Set(prev)
      next.has(symbol) ? next.delete(symbol) : next.add(symbol)
      localStorage.setItem('bithumb_favs', JSON.stringify([...next]))
      track('Favorite Toggled', {
        symbol,
        coin_name: COIN_MAP[symbol]?.name,
        favorited: next.has(symbol),
        location: 'market_list',
      })
      return next
    })
  }

  const rows = useMemo(() => {
    let list = coins.filter((c) => {
      if (tab === 'fav' && !favorites.has(c.symbol)) return false
      if (!query) return true
      const q = query.toLowerCase()
      return c.symbol.toLowerCase().includes(q) || c.name.includes(query)
    })
    const dir = sort.dir === 'asc' ? 1 : -1
    list = [...list].sort((a, b) => {
      if (sort.key === 'name') return a.name.localeCompare(b.name) * dir
      const ta = tickers[a.symbol]
      const tb = tickers[b.symbol]
      return (ta[sort.key] - tb[sort.key]) * dir
    })
    return list
  }, [coins, tickers, query, sort, tab, favorites])

  function changeSort(key) {
    setSort((s) => {
      const next = s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }
      track('Market Sorted', { sort_key: next.key, direction: next.dir, location: 'market_list' })
      return next
    })
  }

  function changeTab(next) {
    setTab(next)
    track('Market Tab Changed', { tab: next, location: 'market_list' })
  }

  function openCoin(symbol, rank) {
    track('Coin Selected', {
      symbol,
      coin_name: COIN_MAP[symbol]?.name,
      list_rank: rank,
      search_active: query.length > 0,
      location: 'market_list',
    })
    navigate(`/trade/${symbol}`)
  }

  return (
    <div className="market-page">
      {!user && (
        <section className="promo-hero">
          <div className="promo-text">
            <span className="promo-eyebrow">{hero.eyebrow}</span>
            <h1>{hero.title}</h1>
            <p>{hero.body}</p>
            <div className="promo-cta">
              <button
                className="btn-primary"
                onClick={() => {
                  track('Promo CTA Clicked', { cta: 'signup', location: 'market_hero' })
                  navigate('/signup')
                }}
              >
                {hero.cta}
              </button>
              <button
                className="btn-ghost"
                onClick={() => {
                  track('Promo CTA Clicked', { cta: 'login', location: 'market_hero' })
                  navigate('/login')
                }}
              >
                로그인
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="market-toolbar">
        <div className="tabs">
          <button className={tab === 'all' ? 'tab active' : 'tab'} onClick={() => changeTab('all')}>
            원화마켓
          </button>
          <button className={tab === 'fav' ? 'tab active' : 'tab'} onClick={() => changeTab('fav')}>
            관심 {favorites.size > 0 && <span className="count">{favorites.size}</span>}
          </button>
        </div>
        <input
          className="search"
          placeholder="코인명 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="market-table">
        <div className="mt-head">
          <span className="col-fav" />
          <button className="col-name" onClick={() => changeSort('name')}>
            자산 {sortArrow(sort, 'name')}
          </button>
          <button className="col-price num" onClick={() => changeSort('price')}>
            현재가 {sortArrow(sort, 'price')}
          </button>
          <button className="col-change num" onClick={() => changeSort('changePct')}>
            전일대비 {sortArrow(sort, 'changePct')}
          </button>
          <span className="col-spark">추이</span>
          <button className="col-vol num" onClick={() => changeSort('volume24')}>
            거래대금(24H) {sortArrow(sort, 'volume24')}
          </button>
        </div>

        {rows.map((c, i) => {
          const t = tickers[c.symbol]
          const up = t.changePct >= 0
          return (
            <div key={c.symbol} className="mt-row" onClick={() => openCoin(c.symbol, i + 1)}>
              <button
                className={`col-fav star ${favorites.has(c.symbol) ? 'on' : ''}`}
                onClick={(e) => toggleFav(c.symbol, e)}
                aria-label="관심 등록"
              >
                ★
              </button>
              <div className="col-name">
                <span className="coin-dot" style={{ background: c.color }}>
                  {c.symbol[0]}
                </span>
                <div className="coin-name">
                  <strong>{c.name}</strong>
                  <span className="ticker">{c.symbol}/KRW</span>
                </div>
              </div>
              <div className={`col-price num ${up ? 'up' : 'down'}`}>{formatPrice(t.price)}</div>
              <div className={`col-change num ${up ? 'up' : 'down'}`}>{formatPct(t.changePct)}</div>
              <div className="col-spark">
                <Sparkline symbol={c.symbol} up={up} />
              </div>
              <div className="col-vol num">{formatVolume(t.volume24)}</div>
            </div>
          )
        })}
        {rows.length === 0 && <div className="empty">표시할 코인이 없습니다.</div>}
      </div>
    </div>
  )
}

function sortArrow(sort, key) {
  if (sort.key !== key) return ''
  return sort.dir === 'asc' ? '▲' : '▼'
}
