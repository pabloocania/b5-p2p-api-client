import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { CreateOrderRequest, CreateUserRequest, GetOrdersParams, Order, OrderResponse, OrderStatus, TakeOrderRequest, UpdateOrderRequest } from './types';
import { isPlainObject, camelCase, snakeCase, transform } from 'lodash';

class BolsilloArgentoAPIClient {
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
        if (status) params.append('status', status);
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

export default BolsilloArgentoAPIClient;