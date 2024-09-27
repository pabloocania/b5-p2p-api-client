import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { CreateOrderRequest, CreateUserRequest, GetOrdersParams, Order, OrderLockedEvent, OrderResponse, ReleaseOrderEvent as OrderReleasedEvent, TakeOrderRequest, TestEventParams, UpdateOrderRequest, TransactionStatusResponse } from './types';
import { isPlainObject, camelCase, snakeCase, transform } from 'lodash';

class P2PMarketplaceAPIClient {
    private readonly client: AxiosInstance;
    private readonly defaultHeaders: Record<string, string>;

    constructor(baseURL: string, timeout: number = 30000) {
        this.client = axios.create({
            baseURL,
            timeout,
        });

        this.defaultHeaders = {
            'x-api-secret': 'test',
            'x-blockchain': 'rsk_testnet'
        };

        // Add a request interceptor to transform request data to snake_case
        this.client.interceptors.request.use((config) => {
            if (config.data) {
                config.data = toSnakeCase(config.data);
            }
            return config;
        }, (error) => {
            return Promise.reject(error);
        });

        // Add a response interceptor to transform response data to camelCase
        this.client.interceptors.response.use((response) => {
            if (response.data) {
                response.data = toCamelCase(response.data);
            }
            return response;
        }, (error) => {
            return Promise.reject(error);
        });
    }

    private mergeHeaders(customHeaders?: Record<string, string>): Record<string, string> {
        return { ...this.defaultHeaders, ...customHeaders };
    }

    private createConfig(headers?: Record<string, string>): AxiosRequestConfig {
        return {
            headers: this.mergeHeaders(headers)
        };
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
        const { status, user, buyer } = props;
        const params = new URLSearchParams();
        if (status) params.append('status', status.join(','));
        if (user) params.append('user', user);
        if (buyer) params.append('buyer', buyer);

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

    public async createUser(user: CreateUserRequest, headers?: Record<string, string>): Promise<Order> {
        const url = '/api/users';
        return this.post<Order>(url, user, headers);
    }

    public async updateOrder(updateRequest: UpdateOrderRequest, headers?: Record<string, string>): Promise<Order> {
        const url = '/api/orders/update';
        return this.post<Order>(url, updateRequest, headers);
    }

    public async testLockFunds(order: Order, testParams?: TestEventParams, headers?: Record<string, string>) {
        const orderEvent: OrderLockedEvent = {
            type: "LOCKED",
            orderId: order.id ?? "",
            buyerAddress: order.buyerAddress ?? "",
            amount: order.amount?.toString() ?? "0",
            transaction: {
                hash: "0x976d8c61b958e286d907a2e1c5ffde8c9316800ab4de1396a54927a39dc533a2",
            },
            tokenContractAddress: "0xee5e8291b551603a19ef41eea69ae49592ed14f8",
            buyerHash:
                "02809d5cc2ec09a7503ef77358654a5bfc958e08c04ecb33f412884c0933be68",
            sellerAddress: "0x2A4E89D18C2742FEDC65444d339cC5fAF3dE4dF1",
            sellerHash:
                "4b3560738b8e3cb8a0a30ac664b12de2ace977c62ade94bc08a37fe5b93bf34b",
            fee: "30000000000000000",
            timestamp: new Date().toISOString(),
        };

        const url = "api/events/simulate/lock"
        try {
            await this.post<undefined>(url, orderEvent, headers);
        } catch (error) {
            console.error("Error locking funds:", error);
            throw new Error("Failed to lock funds");
        }
    }

    public async testReleaseFunds(order: Order, testParams?: TestEventParams, headers?: Record<string, string>) {
        const releaseOrderEvent: OrderReleasedEvent = {
            type: "RELEASED",
            orderId: order.id ?? "",
            buyerAddress: order.buyerAddress ?? "",
            amount: order.amount?.toString() ?? "0",
            transaction: {
                hash: "0xeab4797bf0e13dff0bda481503a544698127c5f97dd826c465ebdb41bcfec3f5",
            },
            tokenContractAddress: "0xee5e8291b551603a19ef41eea69ae49592ed14f8",
            adminAction: true,
            timestamp: new Date().toISOString(),
        };

        const url = "api/events/simulate/release"
        try {
            await this.post<undefined>(url, releaseOrderEvent, headers);
        } catch (error) {
            console.error("Error releasing funds:", error);
            throw new Error("Failed to release funds");
        }
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