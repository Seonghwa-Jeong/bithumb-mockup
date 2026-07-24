# Bithumb Mockup — 암호화폐 거래소 (Amplitude 데모용)

Bithumb 스타일의 암호화폐 거래소 **목업**입니다. 목적은 **Amplitude Analytics + Experiment** 를 시연하는 것입니다.
모든 데이터(계정·잔고·주문)는 브라우저 `localStorage` 에만 저장되며 실제 서버/거래는 없습니다.

## 실행

```bash
cd bithumb-mockup
npm install
npm run dev
```

브라우저에서 http://localhost:5173 이 자동으로 열립니다.

프로덕션 빌드/미리보기:

```bash
npm run build
npm run preview
```

## GitHub Pages 배포

`.github/workflows/deploy.yml` 이 `main` 브랜치 push 시 자동으로 빌드 → GitHub Pages 로 배포합니다.

1. **저장소 Variables 등록** (Amplitude 키 — 로컬 `.env.local` 과 동일 값):

   ```bash
   gh variable set VITE_AMPLITUDE_API_KEY --body <api-key>
   gh variable set VITE_EXPERIMENT_DEPLOYMENT_KEY --body <web-deployment-key>
   ```

   (또는 Settings → Secrets and variables → Actions → **Variables** 에서 수동 추가. 값을 안 넣으면 이벤트가 콘솔에만 출력됩니다. 실제 값은 로컬 `.env.local` 참고.)

2. **Pages 소스 설정**: Settings → Pages → Build and deployment → Source = **GitHub Actions**

3. **push** 하면 배포됩니다. 최초 저장소 생성/푸시 예:

   ```bash
   git init && git add -A && git commit -m "init"
   gh repo create <repo> --public --source=. --push
   ```

- `base` 경로는 빌드 시 저장소명(`/<repo>/`)으로 자동 설정됩니다. (프로젝트 페이지 기준)
- 배포 URL: `https://<user>.github.io/<repo>/`
- 딥링크/새로고침(SPA)은 `public/404.html` 폴백으로 처리합니다.
- 사용자/조직 페이지(`<user>.github.io` 저장소)라면 base 가 `/` 여야 하므로, 워크플로의 `VITE_BASE` 를 `/` 로 바꾸세요.

## 테스트 계정 (하드코딩)

로그인 화면의 "테스트 계정으로 바로 로그인" 버튼으로 원클릭 로그인할 수 있습니다.
모든 비밀번호는 `test1234` 입니다.

| 이메일                  | 닉네임       | 등급  | 보유원화     |
| ----------------------- | ------------ | ----- | ------------ |
| trader01@bithumb.test   | 고래투자자   | VIP   | 50,000,000원 |
| newbie@bithumb.test     | 코린이       | BASIC | 1,000,000원  |
| hodler@bithumb.test     | 존버마스터   | GOLD  | 10,000,000원 |

회원가입도 지원하며, 신규 가입 시 실습용 원화 1,000,000원이 지급됩니다.

## 구현된 거래소 기능

- **로그인 / 회원가입** — 클라이언트 전용, localStorage 세션 유지
- **시세(거래소) 목록** — 12개 코인, 실시간 랜덤워크 시세, 검색·정렬·관심코인, 스파크라인
- **코인 거래 화면**
  - 직접 그린 SVG **캔들스틱 차트** (1분봉, 실시간 갱신, 호버 툴팁)
  - **호가창** — 매도/매수 호가, 잔량 바, 클릭 시 지정가 반영
  - **주문 패널** — 지정가/시장가, 매수/매도, 비율(10/25/50/100%) 버튼, 수수료(0.04%) 계산
- **지연 체결 엔진**
  - 시장가: 접수 후 약 1.5초 뒤 현재가로 체결
  - 지정가: 최소 1.2초 지연 + 시장가가 지정가 조건에 도달하면 체결 (미체결로 대기)
- **투자내역(포트폴리오)** — 보유 코인, 매수평균가, 평가금액·평가손익
- **거래내역** — 미체결/체결/취소 필터, 주문 취소
- **입출금** — 원화 입금/출금 (목업)
- 총 보유자산·주문가능 금액 실시간 반영, 계좌 초기화

## Amplitude 연동

`src/lib/amplitude.js` 한 파일에 모든 트래킹이 모여 있습니다.

### 키 설정 (`.env.local`)

키는 소스가 아닌 `.env.local`(gitignore 됨)에 두고, 코드는 `import.meta.env` 로 참조합니다.

```bash
# .env.local
VITE_AMPLITUDE_API_KEY=<Analytics API Key>
VITE_EXPERIMENT_DEPLOYMENT_KEY=<Experiment "Web"(client-side) Deployment Key>
```

- 키가 없으면(`YOUR_...`) **이벤트가 브라우저 콘솔에만 출력**됩니다. (연동 없이 흐름 확인 가능)
- 실제 키를 넣으면 `@amplitude/analytics-browser` 로 이벤트가 전송되고, `@amplitude/experiment-js-client` 가 노출(exposure)을 자동 트래킹합니다.

### 오토캡쳐 설정

`amplitude.init` 의 `autocapture` 로 설정합니다.

- **활성**: `pageViews`(페이지뷰), `webVitals`(Web Vitals), `sessions`, `attribution`, `formInteractions`, `fileDownloads`, `elementInteractions`
- 페이지 조회는 오토캡쳐가 담당하므로 **수동 `Page Viewed` 이벤트는 두지 않습니다.**

### 직접 태깅 이벤트 (페이지/위치 기준)

명명 규칙: 페이지 고유 동작은 페이지명을 접두어로(`Market Sorted`), 여러 화면 공통 동작은 이름을 통일하고 `location` 속성으로 위치를 구분합니다. 모든 상호작용 이벤트는 `location` 을 포함합니다.

| 이벤트 | 발생 위치(location) | 주요 프로퍼티 |
| --- | --- | --- |
| `Login Succeeded` / `Login Failed` | `login_page` | method, user_tier / failure_reason |
| `Signup Started` / `Completed` / `Failed` | `signup_page` | user_tier, welcome_bonus_krw / failure_reason |
| `Logout` | `global_header` / `session_timeout` | reason |
| `Session Timeout` | (무동작 30분) | idle_minutes, user_tier |
| `Nav Item Clicked` | `global_header` | destination |
| `Promo CTA Clicked` | `market_hero` | cta |
| `Market Tab Changed` / `Market Sorted` | `market_list` | tab / sort_key, direction |
| `Favorite Toggled` | `market_list` | symbol, coin_name, favorited |
| `Coin Selected` | `market_list` · `exchange_sidebar` · `portfolio_holdings` | symbol, coin_name, (list_rank / holding_value_krw …) |
| `Orderbook Price Selected` | `exchange_orderbook` | symbol, price |
| `Order Ratio Clicked` | `exchange_trade_panel` | symbol, side, percent, order_type |
| `Trade Login Prompted` | `exchange_trade_panel` | symbol, side (비로그인 거래 시도) |
| `Order Placed` | `exchange_trade_panel` | symbol, side, order_type, price, amount, notional_krw, fee_krw |
| `Order Filled` | `fill_engine` | fill_price, notional_krw, fee_krw, latency_ms |
| `Order Canceled` | `exchange` / `orders` | order_id, symbol, side, order_type |
| `Orders Filter Changed` | `orders` | filter |
| `Wallet Mode Changed` | `wallet` | mode |
| `Wallet Deposit Completed` | `wallet` | asset, amount, balance_after |
| `Wallet Withdraw Completed` / `Failed` | `wallet` | asset, amount, balance_after / failure_reason |
| `Account Reset` | `portfolio` | user_tier |

### Experiment (A/B) 데모

두 개의 플래그를 사용합니다.

- `login-headline` — 로그인 화면 헤드라인 문구 (`control` / `treatment`)
- `buy-cta` — 매수 버튼 문구·강조 (`control` / `treatment`)

**Experiment 재평가(fetch) 시점** — identity/사용자 속성이 바뀌는 모든 지점에서 `fetchExperiment()` 를 호출합니다: 앱 첫 로딩 · 로그인 · 로그아웃 · 회원가입 · 계좌 등록(초기화) · 세션 타임아웃.

Experiment 키가 없을 때도 콘솔에서 변형을 강제로 바꿔 눈으로 A/B 를 확인할 수 있습니다.

```js
// 브라우저 콘솔에서
__bithumbExp.forceVariant('buy-cta', 'treatment')   // 또는 'control'
__bithumbExp.forceVariant('login-headline', 'treatment')
// 이후 새로고침
```

## 폴더 구조

```
src/
  lib/        amplitude.js(트래킹) · accounts.js(테스트계정) · market.js(시세엔진) · format.js
  context/    AuthContext.jsx(인증) · MarketContext.jsx(시세·포트폴리오·주문·체결엔진)
  components/ Header · CoinChart · OrderBook · TradePanel · Sparkline
  pages/      Login · Signup · Market · Exchange · Portfolio · Orders · Wallet
```

## 참고

- 시세는 실제 시장 데이터가 아닌 평균회귀가 섞인 **랜덤 워크 시뮬레이션**입니다.
- 인증/저장은 데모용이며 보안 기능이 아닙니다. 실제 서비스에 사용하지 마세요.
