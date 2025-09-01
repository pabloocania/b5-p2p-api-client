export type OrderType = 'SELL' | 'BUY';

export type OrderStatus =
    'WAITING_PAYMENT' |
    'WAITING_BUYER_ADDRESS' |
    'WAITING_APPROVE' |
    'APPROVED' |
    'WAITING_ESCROW' |
    'PENDING' |
    'ACTIVE' |
    'FIAT_SENT' |
    'RELEASED' |
    'CLOSED' |
    'DISPUTE' |
    'CANCELED' |
    'SUCCESS' |
    'PAID_HOLD_INVOICE' |
    'CANCELED_BY_ADMIN' |
    'EXPIRED' |
    'COMPLETED_BY_ADMIN';

export interface TransactionStatusResponse {
    hash: string;
    block_number: number | null;
    status: 'PENDING' | 'SUCCESSFULL' | 'FAILED';
}

export interface Order {
    type: OrderType;
    id?: string;
    description?: string;
    amount?: string;
    fee?: string;
    maxFiatAmount?: string;
    minFiatAmount?: string;
    creatorId?: string;
    sellerId?: string;
    sellerUsername?: string;
    buyerId?: string;
    buyerUsername?: string;
    buyerAddress?: string;
    status?: OrderStatus;
    tokenCode?: string;
    fiatAmount?: string;
    fiatCode: string;
    paymentMethods?: PaymentMethod[];
    createdAt?: string; // ISO 8601 string
    transaction?: string;
    buyerHash?: string;
    sellerHash?: string;
    isLocked?: boolean;
    txLock?: string;
    txRelease?: string;
    buyerHasRated: boolean;
    sellerHasRated: boolean;
    availableBlockchains?: string[];
    blockchain?: string;
    creatorRating: string;
    transactionsCount: number;
    chatId: string;
    userMetrics?: UserMetrics[];
    buyerCanDispute?: boolean;
    sellerCanDispute?: boolean;
    buyerDisputed?: boolean;
    sellerDisputed?: boolean;
    escrowOrder?: EscrowOrderModel;
    dispute?: Dispute[];
}

export interface OrderResponse {
    orders: Order[]
}

export interface UsersResponse {
    users: KioscoinUser[]
}

export interface UserSettings {
    preferredTokenCode?: string;
    paymentMethods: PaymentMethod[];
}

export interface UpdateUserSettingsRequest {
    userId: string;
    settings: UserSettings;
}

export interface PaymentMethod {
    type: string;
    alias?: string;
    cbu?: string;
    fullName?: string;
    entity?: string;
}

export interface CreateOrderRequest {
    type: OrderType;
    description: string;
    amount: string;
    tokenCode: string;
    fiatAmount?: string;
    minFiatAmount?: string;
    maxFiatAmount?: string;
    fiatCode: string;
    paymentMethods?: PaymentMethod[];
    status?: OrderStatus;
    priceMargin?: number;
    walletAddress?: string;
    creatorId?: string;
    creatorUsername?: string;
    buyerHash?: string;
    sellerHash?: string;
}

export interface GetOrdersParams {
    status?: string[];
    user?: string;
    buyer?: string;
    orderType?: string[];
    blockchain?: string[];
    tokenCode?: string[];
    paymentMethods?: PaymentMethod[];
    fiatCode?: string[];
    fiatAmountRange?: {
        min?: string;
        max?: string;
    };
    dateRange?: {
        from?: string;
        to?: string;
    };
    search?: string;
}

export type TakeOrderRequest = TakeSellOrderRequest | TakeBuyOrderRequest;

export interface TakeSellOrderRequest {
    type: string;
    orderId: string;
    userId: string;
    buyerAddress?: string;
    fiatAmount?: string;
    username?: string;
    hash?: string;
}

export interface TakeBuyOrderRequest {
    type: string;
    orderId: string;
    userId: string;
    amount: string;
    username?: string;
    paymentMethods?: PaymentMethod[];
    hash?: string;
}

export interface CreateUserRequest {
    id: string;
    username: string;
}

export interface UpdateOrderRequest {
    status: string;
    orderId: string;
    sellerId?: string;
    takenAt?: string;
    isLocked?: boolean;
    txLock?: string;
    txRelease?: string;
}

export interface RateUserRequest {
    userId: string;
    rating: number;
    orderId: string;
}

export interface OrderLockedEvent {
    type: string;
    orderId: string;
    buyerAddress: string;
    amount?: string;
    transaction?: {
        hash: string;
    };
    tokenContractAddress: string;
    buyerHash: string;
    sellerAddress: string;
    sellerHash: string;
    fee: string;
    timestamp: string;
}


export interface ReleaseOrderEvent {
    type: string;
    orderId: string;
    buyerAddress: string;
    amount: string;
    transaction: {
        hash: string;
    };
    tokenContractAddress: string;
    adminAction: boolean;
    timestamp: string;
}

export interface OrderEvent {
    orderId: string;
    timestamp: string;
    eventType: string;
}

export interface OrderEventsResponse {
    orderEvents: OrderEvent[];
}

export interface PushNotificationsRegisterRequest {
    token: string;
    userId: string;
}

export interface DashboardMetricsResponse {
    dashboardMetrics: DashboardMetrics;
}

export interface DashboardMetrics {
    volumeTx: BlockchainVolumes[];
    ordersPerBlockchain: OrdersPerBlockchain[];
    ordersCompletedTx: number; // Total number of completed orders
    feesCollected: FeeCollected[]; // Assuming this is defined elsewhere
    durationInEscrowPerOrder: ReleasedOrderDuration[]; // Assuming this is defined elsewhere
}

export interface BlockchainVolumes {
    blockchainName: string;
    volumes: TokenAmount;
}

export interface TokenAmount {
    tokenCode: string;
    amount: string; // Assuming Amount is defined elsewhere
}

export interface OrdersPerBlockchain {
    blockchainName: string;
    completedOrders: number;
}

export interface FeeCollected {
    blockchainName: string;
    fees: TokenAmount[]
}

export interface ReleasedOrderDuration {
    orderId: string
    blockchain: string
    lockedAt: string
    releasedAt: string
    duration: number
}

export interface ConfigResponse<T = any> {
    config: T;
}

export interface TestEventParams {

}

export interface UserMetrics {
    userId: string;
    avgTimeToLock: number;
    avgTimeToRelease: number;
    avgTimeToFiatSent: number;
}

export interface UserReview {
    reviewId?: string;
    rating?: number;
    reviewedAt?: string;
}

export interface KioscoinUser {
    id?: string;
    username?: string;
    lang?: string;
    tradesCompleted?: number;
    totalReviews?: number;
    lastRating: string;
    totalRating: string;
    volumeTraded?: number;
    admin?: boolean;
    banned?: boolean;
    showUsername?: boolean;
    showVolumeTraded?: boolean;
    lightningAddress?: string;
    disputes?: number;
    defaultCommunityId?: string;
    timeToLock?: number;
    timeToRelease?: number;
    timeToFiatSent?: number;
    reviews?: UserReview[];
}

export type DisputeReason = 'SELLER_NOT_LOCKING' | 'BUYER_FIAT_NOT_SENT' | 'SELLER_NOT_RELEASING';

export interface CreateDisputeRequest {
    orderId: string;
    creatorId: string;
    reason: DisputeReason;
}

export interface Dispute {
    id?: string;
    orderId: string;
    buyerId?: string;
    sellerId?: string;
    orderType: OrderType;
    creatorId: string;
    status: 'OPEN' | 'CANCELED' | 'COMPLETED' | 'REFUND_FAILED';
    resolution?: 'BUYER_REFUNDED' | 'SELLER_REFUNDED';
    reason: DisputeReason;
}

export interface DisputesResponse {
    disputes: Dispute[];
}


export interface OrderOffer {
    id: string;
    type: OrderType;
    tokenAmount: string;
    exchangeMethods: PaymentMethod[];
    tokenCode: string;
    blockchain: string;
    fiatCode: string;
    fiatAmount: string;
    title: string;
    actionButtonDescription: string;
    exchangeRateOfferId?: string;
}

export interface OrderOffersResponse {
    offers: OrderOffer[];
}

export interface TransactionRequest {
    offer: OrderOffer;
    buyerAddress?: string;
}

export type EscrowOrderStatus = 'NON_EXISTING' | 'LOCKED' | 'RELEASED' | 'REFUNDED';

export interface EscrowOrderModel {
    id: string;
    timestamp?: string;
    tokenContractAddress?: string;
    buyerAddress?: string;
    sellerAddress?: string;
    amount?: string;
    fee?: string;
    status?: EscrowOrderStatus;
    adminAction?: boolean;
    token?: string;
}

export interface ExchangeRateOffer {
    id: string;
    tokenCode: string;
    blockchainEnvironment: string;
    fiatCode: string;
    baseFiatRate: string;
    offeredFiatRate: string;
    margin: string;
    validUntil: string;
    isActive: boolean;
    createdAt: string;
}

export interface KioscoinOperation {
    orderType: OrderType;
    tokenAmount: string;
    fiatAmount: string;
    tokenCode: string;
    fiatCode: string;
    blockchain: string;
    userId: string;
    username?: string;
    buyerAddress?: string;
    paymentMethods?: PaymentMethod[];
    orderOffer?: OrderOffer;
    exchangeRateOffer?: ExchangeRateOffer;
}

export type OperationErrorType = 'INVALID_TRANSACTION' | 'HAS_ACTIVE_ORDERS' | 'INSUFFICIENT_FUNDS' | 'UNKNOWN_ERROR';

export interface OperationError {
    type: OperationErrorType;
    message: string;
}

export interface KioscoinOperationResponse {
    error?: OperationError;
    order?: Order;
}
