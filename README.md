# Bolsillo Argento API Client

A TypeScript client for the Bolsillo Argento API.

## Installation

You can install the package via npm:

`npm install ba-api-client@0.0.1 `

## Usage

First, import and initialize the `BolsilloArgentoAPIClient`:

```typescript
import { BolsilloArgentoAPIClient } from "bolsillo-argento-api-client";
const BASE_URL = "https://bolsillo-argento-586dfd80364d.herokuapp.com";
const client = new BolsilloArgentoAPIClient(BASE_URL);
```

## API

### `getOrders(status?: OrderStatus, headers?: Record<string, string>): Promise<OrderResponse>`

Fetches a list of orders with an optional status filter.

**Parameters:**

- `status` (optional): The status of the orders to fetch.
- `headers` (optional): Additional headers to include in the request.

**Returns:**

- A promise that resolves to an `OrderResponse` object.

### `getOrderById(id: string, headers?: Record<string, string>): Promise<OrderResponse>`

Fetches an order by its ID.

**Parameters:**

- `id`: The ID of the order to fetch.
- `headers` (optional): Additional headers to include in the request.

**Returns:**

- A promise that resolves to an `OrderResponse` object.

### `createOrder(order: CreateOrderRequest, headers?: Record<string, string>): Promise<OrderResponse>`

Creates a new order.

**Parameters:**

- `order`: The order details.
- `headers` (optional): Additional headers to include in the request.

**Returns:**

- A promise that resolves to the created `OrderResponse` object.

### `takeOrder(order: TakeOrderRequest, headers?: Record<string, string>): Promise<Order>`

Takes an order.

**Parameters:**

- `order`: The order details, which can be either `TakeSellOrderRequest` or `TakeBuyOrderRequest`.
- `headers` (optional): Additional headers to include in the request.

**Returns:**

- A promise that resolves to the taken `Order` object.

### `createUser(user: CreateUserRequest, headers?: Record<string, string>): Promise<Order>`

Creates a new user.

**Parameters:**

- `user`: The user details.
- `headers` (optional): Additional headers to include in the request.

**Returns:**

- A promise that resolves to the created `Order` object.

### `updateOrder(updateRequest: UpdateOrderRequest, headers?: Record<string, string>): Promise<Order>`

Updates an order's status.

**Parameters:**

- `updateRequest`: The update request details.
- `headers` (optional): Additional headers to include in the request.

**Returns:**

- A promise that resolves to the updated `Order` object.
