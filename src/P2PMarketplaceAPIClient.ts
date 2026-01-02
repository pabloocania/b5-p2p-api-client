import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { CreateOrderRequest, CreateUserRequest, Order, OrderResponse, TakeOrderRequest, TestEventParams, UpdateOrderRequest, TransactionStatusResponse, RateUserRequest, OrderEventsResponse, PushNotificationsRegisterRequest, ConfigResponse, DashboardMetricsResponse, UsersResponse, GetOrdersParams, CreateDisputeRequest, DisputesResponse, OrderOffersResponse, TransactionRequest, KioscoinOperationResponse, UpdateUserSettingsRequest, NotificationsResponse, VerifyEmailRequest, CreateSessionRequest, CreateSessionResponse, SaveOpsLogRequest, SaveOpsLogResponse } from './types';
import { AuthTokenProvider } from './auth/AuthTokenProvider';
import { isPlainObject, camelCase, snakeCase, transform } from 'lodash';

export interface RequestConfigWithRetry extends AxiosRequestConfig {
    _retry?: boolean;
}

class P2PMarketplaceAPIClient {
    private readonly client: AxiosInstance;
    private readonly defaultHeaders: Record<string, string>;
    private authTokenProvider?: AuthTokenProvider;
    private refreshTokenPromise?: Promise<string | null>;

    constructor(baseURL: string, timeout: number = 30000) {
        this.client = axios.create({
            baseURL,
            timeout,
            withCredentials: true, // Enable sending/receiving cookies
        });

        this.defaultHeaders = {
            'x-api-secret': 'test',
            'x-blockchain': 'rsk_testnet'
        };

        // Add a request interceptor to transform request data to snake_case
        this.client.interceptors.request.use(async (config) => {
            if (config.data) {
                config.data = toSnakeCase(config.data);
            }
            const provider = this.authTokenProvider;
            if (!provider) {
                return config;
            }

            return provider
                .getToken()
                .then((token) => {
                    if (token) {
                        config.headers = config.headers ?? {};
                        config.headers['Authorization'] = `Bearer ${token}`;
                    }
                    return config;
                })
                .catch((error) => {
                    console.warn('[P2PMarketplaceAPIClient] Failed to obtain auth token before request:', error);
                    return config;
                });
        }, (error) => {
            return Promise.reject(error);
        });

        // Add a response interceptor to transform response data to camelCase
        this.client.interceptors.response.use((response) => {
            if (response.data) {
                response.data = toCamelCase(response.data);
            }
            return response;
        }, async (error: AxiosError) => {
            const { response, config } = error;
            if (!this.authTokenProvider || response?.status !== 401 || !config) {
                return Promise.reject(error);
            }

            const originalRequest = config as RequestConfigWithRetry;
            if (originalRequest._retry) {
                return Promise.reject(error);
            }

            originalRequest._retry = true;

            try {
                const newToken = await this.getRefreshedToken();
                if (!newToken) {
                    return Promise.reject(error);
                }

                originalRequest.headers = originalRequest.headers ?? {};
                originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                return this.client(originalRequest);
            } catch (refreshError) {
                if (this.authTokenProvider?.onRefreshFailure) {
                    this.authTokenProvider.onRefreshFailure(refreshError);
                }
                return Promise.reject(error);
            }
        });
    }

    setAuthTokenProvider(provider?: AuthTokenProvider) {
        this.authTokenProvider = provider;
        this.refreshTokenPromise = undefined;
    }

    private mergeHeaders(customHeaders?: Record<string, string>): Record<string, string> {
        return { ...this.defaultHeaders, ...customHeaders };
    }

    private createConfig(headers?: Record<string, string>): AxiosRequestConfig {
        return {
            headers: this.mergeHeaders(headers)
        };
    }

    private async getRefreshedToken(): Promise<string | null> {
        if (!this.authTokenProvider) {
            return null;
        }

        if (!this.refreshTokenPromise) {
            this.refreshTokenPromise = this.authTokenProvider
                .refreshToken()
                .catch((error) => {
                    if (this.authTokenProvider?.onRefreshFailure) {
                        this.authTokenProvider.onRefreshFailure(error);
                    }
                    throw error;
                })
                .finally(() => {
                    this.refreshTokenPromise = undefined;
                });
        }

        return this.refreshTokenPromise;
    }

    async get<T>(url: string, headers?: Record<string, string>): Promise<T> {
        const config = this.createConfig(headers);
        try {
            const response = await this.client.get<T>(url, config);
            return response.data;
        } catch (error) {
            console.error(`GET request to ${url} failed:`, error);
            throw error;
        }
    }

    async post<T>(url: string, data: any, headers?: Record<string, string>): Promise<T> {
        const config = this.createConfig(headers);
        try {
            const response = await this.client.post<T>(url, data, config);
            return response.data;
        } catch (error) {
            console.error(`POST request to ${url} failed:`, error);
            throw error;
        }
    }

    public async getOrders(props: GetOrdersParams, headers?: Record<string, string>): Promise<OrderResponse> {
        const {
            status,
            user,
            orderType,
            blockchain,
            tokenCode,
            paymentMethods,
            fiatCode,
            fiatAmountRange,
            dateRange,
            search
        } = props;

        const params = new URLSearchParams();
        if (status) params.append('status', status.join(','));
        if (user) params.append('user', user);
        if (orderType) params.append('type', orderType.join(','));
        if (blockchain) params.append('blockchains', blockchain.join(','));
        if (tokenCode) params.append('tokens', tokenCode.join(','));
        if (paymentMethods) params.append('payments', paymentMethods.join(','));
        if (fiatCode) params.append('fiatCode', fiatCode.join(','));
        if (fiatAmountRange?.min) params.append('minFiatAmount', fiatAmountRange.min);
        if (fiatAmountRange?.max) params.append('maxFiatAmount', fiatAmountRange.max);
        if (dateRange?.from) params.append('fromDate', dateRange.from);
        if (dateRange?.to) params.append('toDate', dateRange.to);
        if (search) params.append('search', search);

        const url = `/api/orders?${params.toString()}`;
        return this.get<OrderResponse>(url, headers);
    }

    public async getOrderById(id: string, headers?: Record<string, string>): Promise<OrderResponse> {
        const url = `/api/orders/${id}`;
        return this.get<OrderResponse>(url, headers);
    }

    public async createOrder(order: CreateOrderRequest, headers?: Record<string, string>): Promise<OrderResponse> {
        const url = '/api/orders';
        return this.post<OrderResponse>(url, order, headers);
    }

    public async takeOrder(order: TakeOrderRequest, headers?: Record<string, string>): Promise<OrderResponse> {
        const url = '/api/orders/take';
        return this.post<OrderResponse>(url, order, headers);
    }

    public async updateOrder(updateRequest: UpdateOrderRequest, headers?: Record<string, string>): Promise<Order> {
        const url = '/api/orders/update';
        return this.post<Order>(url, updateRequest, headers);
    }

    public async createUser(user: CreateUserRequest, headers?: Record<string, string>): Promise<UsersResponse> {
        const url = '/api/users';
        return this.post<UsersResponse>(url, user, headers);
    }

    public async getUser(userId: string, headers?: Record<string, string>): Promise<UsersResponse> {
        const url = `/api/users/${userId}`;
        return this.get<UsersResponse>(url, headers);
    }

    public async rateUser(rateUserRequest: RateUserRequest, headers?: Record<string, string>): Promise<any> {
        const url = '/api/users/rate';
        return this.post<any>(url, rateUserRequest, headers);
    }

    public async updateUserSettings(request: UpdateUserSettingsRequest, headers?: Record<string, string>): Promise<UsersResponse> {
        const url = '/api/users/settings';
        return this.post<UsersResponse>(url, request, headers);
    }

    public async verifyUserEmail(request: VerifyEmailRequest, headers?: Record<string, string>): Promise<UsersResponse> {
        const url = '/api/users/verify_email';
        return this.post<UsersResponse>(url, request, headers);
    }

    public async registerPushToken(registerRequest: PushNotificationsRegisterRequest, headers?: Record<string, string>): Promise<any> {
        const url = `/api/notifications/register-push`;
        return this.post<PushNotificationsRegisterRequest>(url, registerRequest, headers);
    }

    public async listNotifications(limit: number = 10, offset: number = 0, headers?: Record<string, string>): Promise<NotificationsResponse> {
        const url = `/api/notifications?limit=${limit}&offset=${offset}`;
        return this.get<NotificationsResponse>(url, headers);
    }

    public async markNotificationAsRead(notificationId: string, headers?: Record<string, string>): Promise<NotificationsResponse> {
        const url = `/api/notifications/${notificationId}/read`;
        return this.post<any>(url, {}, headers);
    }

    public async getConfig<T>(): Promise<ConfigResponse<T>> {
        const url = '/api/configuration';
        return await this.get<ConfigResponse<T>>(url);
    }

    public async getOrderEvents(id: string, headers?: Record<string, string>): Promise<OrderEventsResponse> {
        const url = `/api/events/order/${id}`;
        return this.get<OrderEventsResponse>(url, headers);
    }

    public async getDashboardMetrics(headers?: Record<string, string>): Promise<DashboardMetricsResponse> {
        const url = '/api/dashboard/metrics';
        return this.get<DashboardMetricsResponse>(url, headers);
    }

    public async getOrderOffers(headers?: Record<string, string>): Promise<OrderOffersResponse> {
        const url = '/api/order_offers';
        return this.get<OrderOffersResponse>(url, headers);
    }

    public async pointOfSaleTransact(request: TransactionRequest, headers?: Record<string, string>): Promise<KioscoinOperationResponse> {
        const url = '/api/point_of_sale/transact';
        return this.post<KioscoinOperationResponse>(url, request, headers);
    }


    public async releaseFunds(order: Order, testParams?: TestEventParams, headers?: Record<string, string>): Promise<string> {
        const body = {
            orderId: order.id ?? "",
            isAdmin: true
        };

        const url = "api/orders/release"
        try {
            return await this.post<string>(url, body, headers);
        } catch (error) {
            console.error("Error releasing funds:", error);
            throw new Error("Failed to release funds");
        }
    }

    public async getTransactionStatus(txHash: string, headers?: Record<string, string>): Promise<TransactionStatusResponse> {
        const url = `/api/blockchain/transactions/${txHash}`;
        return this.get<TransactionStatusResponse>(url, headers);
    }

    public async createDispute(request: CreateDisputeRequest, headers?: Record<string, string>): Promise<DisputesResponse> {
        const url = '/api/dispute';
        return this.post<DisputesResponse>(url, request, headers);
    }

    /**
     * Cancel/delete an order by its ID
     * Only allowed for orders in PENDING or WAITING_PAYMENT status
     */
    public async cancelOrder(orderId: string, headers?: Record<string, string>): Promise<void> {
        const url = `/api/orders/${orderId}`;
        const config = this.createConfig(headers);
        try {
            await this.client.delete(url, config);
        } catch (error) {
            console.error(`DELETE request to ${url} failed:`, error);
            throw error;
        }
    }

    // OpsLog

    /**
     * Save a UserOperation receipt to the database
     * @param request - The SaveOpsLogRequest containing chainId, userOp, and optional orderId/opsType
     * @param headers - Optional custom headers
     * @returns SaveOpsLogResponse with the saved log id and success status
     */
    public async saveOpsLog(request: SaveOpsLogRequest, headers?: Record<string, string>): Promise<SaveOpsLogResponse> {
        const url = '/api/ops/log';
        return this.post<SaveOpsLogResponse>(url, request, headers);
    }

    // Session Management

    /**
     * Create or refresh a session with Firebase ID token
     * Sets a session cookie that will be used for WebSocket authentication
     */
    public async createSession(request: CreateSessionRequest, headers?: Record<string, string>): Promise<CreateSessionResponse> {
        const url = '/api/session';
        return this.post<CreateSessionResponse>(url, request, headers);
    }

    /**
     * Check if the current session is valid
     * Returns session status and userId if valid
     */
    public async getSessionStatus(headers?: Record<string, string>): Promise<CreateSessionResponse> {
        const url = '/api/session';
        return this.get<CreateSessionResponse>(url, headers);
    }

    /**
     * Clear the session cookie (logout)
     * Destroys the session on the backend
     */
    public async clearSession(headers?: Record<string, string>): Promise<{ success: boolean }> {
        const url = '/api/session';
        const config = this.createConfig(headers);
        try {
            const response = await this.client.delete<{ success: boolean }>(url, config);
            return response.data;
        } catch (error) {
            console.error(`DELETE request to ${url} failed:`, error);
            throw error;
        }
    }

}

function toSnakeCase(obj: any): any {
    if (Array.isArray(obj)) {
        return obj.map(toSnakeCase);
    } else if (isPlainObject(obj)) {
        return transform(obj, (result, value, key) => {
            result[snakeCase(key as string)] = toSnakeCase(value);
        });
    }
    return obj;
}

function toCamelCase(obj: any): any {
    if (Array.isArray(obj)) {
        return obj.map(toCamelCase);
    } else if (isPlainObject(obj)) {
        return transform(obj, (result, value, key) => {
            result[camelCase(key as string)] = toCamelCase(value);
        });
    }
    return obj;
}

export default P2PMarketplaceAPIClient;
