# b5-api-client

TypeScript client for the **Kioscoin P2P stablecoin marketplace** backend.

It wraps the marketplace REST API (orders, users, escrow, disputes, notifications, sessions) and
ships a ready-to-use **Firebase authentication service** that automatically attaches and refreshes
ID tokens on every request. It is the shared SDK used by the
[Kioscoin web app](https://github.com/pabloocania/b5-p2p-marketplace).

## Features

- **Typed API client** — every endpoint and payload is described in `src/types.ts`
- **Automatic auth** — pluggable `AuthTokenProvider` adds `Authorization: Bearer <token>` and
  transparently retries once on `401` with a refreshed token (concurrent refreshes are de-duplicated)
- **Case conversion** — requests are sent as `snake_case`, responses are returned as `camelCase`
- **Firebase login service** — email/password, passwordless email link, Google, Facebook, Twitter,
  email verification, password reset and FCM push tokens
- **Typed error handling** — `parseApiError` maps backend errors to `ValidationError` codes
- **Escrow helpers** — `generateSecretAndHash()` creates a 32-byte secret and its SHA-256 hash

## Installation

```bash
npm install b5-api-client
```

Requires Node.js 18+ (see `.nvmrc`). Works in the browser and in Node.

## Quick start

```typescript
import { P2PMarketplaceAPIClient, FirebaseService } from "b5-api-client";

const client = new P2PMarketplaceAPIClient(process.env.API_BASE_URL!);

// Optional: wires Firebase auth into the client (token injection + refresh)
const auth = new FirebaseService(client, {
  emailVerificationUrl: "https://app.example.com/auth/email-verified",
  actionCodeSettings: {
    url: "https://app.example.com/auth/verify-email",
    handleCodeInApp: true,
  },
});

await auth.signInWithEmail("alice@example.com", "s3cret");

const { orders } = await client.getOrders({
  status: ["PENDING"],
  orderType: ["SELL"],
  tokenCode: ["USDT"],
});
```

`FirebaseService` loads its Firebase config from the backend (`GET /api/configuration`), so no
Firebase keys need to be bundled with the client.

### Custom authentication

Any token source can be plugged in by implementing `AuthTokenProvider`:

```typescript
client.setAuthTokenProvider({
  getToken: async () => myStore.accessToken,
  refreshToken: async () => myStore.refresh(),
  onRefreshFailure: (error) => myStore.logout(),
});
```

Every method also accepts an optional `headers` argument to override headers per request.

## API overview

| Area | Methods | Endpoint |
|------|---------|----------|
| **Orders** | `getOrders(params)` | `GET /api/orders` |
| | `getOrderById(id)` | `GET /api/orders/:id` |
| | `createOrder(order)` | `POST /api/orders` |
| | `takeOrder(request)` | `POST /api/orders/take` |
| | `updateOrder(request)` | `POST /api/orders/update` |
| | `cancelOrder(id)` | `DELETE /api/orders/:id` |
| | `getOrderEvents(id)` | `GET /api/events/order/:id` |
| | `getOrderOffers()` | `GET /api/order_offers` |
| **Escrow** | `getOrderSecret(orderId)` | `GET /api/orders/:id/secret` |
| | `getEscrowSecretsForSeller(orderId)` | `GET /api/orders/:id/escrow-secrets` |
| | `releaseFunds(order)` *(admin)* | `POST /api/orders/release` |
| | `getTransactionStatus(txHash)` | `GET /api/blockchain/transactions/:hash` |
| | `saveOpsLog(request)` | `POST /api/ops/log` |
| **Users** | `createUser`, `getUser`, `rateUser`, `updateUserSettings`, `verifyUserEmail` | `/api/users/*` |
| **Disputes** | `createDispute(request)` | `POST /api/dispute` |
| **Notifications** | `registerPushToken`, `listNotifications`, `markNotificationAsRead` | `/api/notifications/*` |
| **Session** | `createSession`, `getSessionStatus`, `clearSession` | `/api/session` (cookie used for WebSocket auth) |
| **Point of sale** | `pointOfSaleTransact(request)` | `POST /api/point_of_sale/transact` |
| **Platform** | `getConfig()`, `getDashboardMetrics()` | `/api/configuration`, `/api/dashboard/metrics` |
| **Raw** | `get<T>(url)`, `post<T>(url, body)` | any |

### Filtering orders

`getOrders` accepts a `GetOrdersParams` object; all fields are optional:

| Field | Type | Query param |
|-------|------|-------------|
| `status` | `OrderStatus[]` | `status` |
| `orderType` | `('BUY' \| 'SELL')[]` | `type` |
| `user` | `string` | `user` |
| `blockchain` | `string[]` | `blockchains` |
| `tokenCode` | `string[]` | `tokens` |
| `paymentMethods` | `string[]` | `payments` |
| `fiatCode` | `string[]` | `fiatCode` |
| `fiatAmountRange` | `{ min?, max? }` | `minFiatAmount`, `maxFiatAmount` |
| `dateRange` | `{ from?, to? }` | `fromDate`, `toDate` |
| `search` | `string` | `search` |

### Order lifecycle

Main statuses (see `OrderStatus` for the full list):

```
PENDING ─► ACTIVE ─► WAITING_PAYMENT ─► FIAT_SENT ─► RELEASED ─► CLOSED
   │                       │                │
   └──► CANCELED / EXPIRED └──► DISPUTE ────┴──► COMPLETED_BY_ADMIN / CANCELED_BY_ADMIN
```

On-chain escrow states are tracked separately as `EscrowOrderStatus`:
`NON_EXISTING | LOCKED | RELEASED | REFUNDED`.

## Error handling

```typescript
import { parseApiError } from "b5-api-client";

try {
  await client.createOrder(order);
} catch (err) {
  const apiError = parseApiError(err);
  switch (apiError.error) {
    case "ORDER_AMOUNT_TOO_LOW":
    case "ORDER_AMOUNT_TOO_HIGH":
      // show amount validation
      break;
    case "USER_HAS_ACTIVE_ORDERS_AS_CREATOR":
      // user must finish current order first
      break;
    default:
      console.error(apiError.message);
  }
}
```

Validation codes: `USER_HAS_ACTIVE_ORDERS_AS_CREATOR`, `USER_HAS_TOO_MANY_PENDING_ORDERS`,
`ORDER_AMOUNT_TOO_LOW`, `ORDER_AMOUNT_TOO_HIGH`, `USER_HAS_ACTIVE_ORDERS`, `ORDER_NOT_FOUND`,
`ORDER_CANCELLATION_NOT_ALLOWED`, `INVALID_REQUEST`.

## Exports

| Export | Description |
|--------|-------------|
| `P2PMarketplaceAPIClient` | REST client |
| `FirebaseService`, `AuthProvider`, `UserData`, `AuthResult` | Firebase login service and result types |
| `createLoginService(config)` | Factory returning a `LoginService` (currently `provider: 'firebase'`) |
| `userContext` | Singleton holding the logged-in `User` |
| `parseApiError`, `hasValidationError`, `ValidationError` | Error helpers |
| `generateSecretAndHash()` | Escrow secret + SHA-256 hash (Node `crypto`) |
| `*` from `types` | All request/response models |

## Project structure

```
src/
  P2PMarketplaceAPIClient.ts   REST client, interceptors, case conversion
  types.ts                     API models (orders, users, disputes, notifications, …)
  errors.ts                    Typed backend error parsing
  cryptoUtils.ts               Escrow secret/hash generation
  auth/
    AuthTokenProvider.ts       Token provider contract
    FirebaseLoginService.ts    Firebase auth + FCM implementation
    LoginService.ts            LoginService interface and factory
    UserContext.ts             In-memory current user singleton
  APITester.ts                 Manual smoke tests against a running backend
```

## Development

```bash
npm install
npm run build        # compile to dist/
npm run test:api     # run APITester.ts against the backend configured in the file
```

To test changes locally in a consuming app:

```bash
npm run build && npm link            # in this repo
npm link b5-api-client               # in the consuming app
```

### Publishing

```bash
npm version patch
npm run build
npm publish
```
