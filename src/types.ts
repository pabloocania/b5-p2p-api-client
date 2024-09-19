export type OrderType = 'SELL' | 'BUY';

export type OrderStatus =
    'WAITING_DEPOSIT' |
    'WAITING_BUYER_ADDRESS' |
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


export interface PaymentMethod {
    type: string;
    username: string;
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
    buyerId?: string;
    buyerAddress?: string;
    status?: OrderStatus;
    tokenCode?: string;
    fiatAmount?: string;
    fiatCode: string;
    paymentMethod?: PaymentMethod[];
    createdAt?: string; // ISO 8601 string
    transaction?: string;
}

export interface OrderResponse {
    orders: Order[]
}

export interface PaymentMethod {
    type: string;
    username: string;
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
}

export interface GetOrdersParams {
    status?: OrderStatus[];
    user?: string;
    buyer?: string;
}

export type TakeOrderRequest = TakeSellOrderRequest | TakeBuyOrderRequest;

export interface TakeSellOrderRequest {
    type: string;
    orderId: string;
    userId: string;
    buyerAddress?: string;
    fiatAmount?: string;
}

export interface TakeBuyOrderRequest {
    type: string;
    orderId: string;
    userId: string;
    amount: string;
}

export interface CreateUserRequest {
    username: string;
}

export interface UpdateOrderRequest {
    status: string;
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

export interface TestEventParams {

}