import axios from 'axios';
import BolsilloArgentoAPIClient from './BolsilloArgentoAPIClient';
import { CreateOrderRequest, CreateUserRequest, OrderStatus, TakeSellOrderRequest, UpdateOrderRequest } from './types';

const BASE_URL = 'https://bolsillo-argento-586dfd80364d.herokuapp.com'; // Replace with your actual base URL
// const BASE_URL = 'http://localhost:8080'; // Replace with your actual base URL
const client = new BolsilloArgentoAPIClient(BASE_URL);

async function runTest(testFunction: () => Promise<void>) {
    try {
        await testFunction();
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Error message:', error.message);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
        } else {
            console.error('Unexpected error:', error);
        }
    }
}

async function testHealthCheck() {
    const response = await client.get<{ status: string }>('/api/health_check');
    console.log('Status:', response);
}

async function testGetOrders() {
    const response = await client.getOrders({ status: ['PENDING'] });
    console.log('Orders:', response)
}

async function testGetOrderById() {
    const orderId = '168434dc-546c-497b-a125-0fb15f364511'; // Replace with a valid order ID
    const response = await client.getOrderById(orderId, {
        'x-api-secret': 'test',
        'x-blockchain': 'rsk_testnet'
    });
    console.log('Order:', response);
    // console.log('Data:', response.data);
}

async function testCreateOrder() {
    const order: CreateOrderRequest = {
        type: 'SELL',
        description: 'Test full flow ts',
        amount: '0.023',
        tokenCode: 'RBTC',
        fiatAmount: '232323',
        status: "PENDING",
        fiatCode: 'ARS',
        paymentMethods: [
            {
                type: 'MERCADO_PAGO',
                username: 'blas'
            }
        ],
        creatorId: '7b74abef-f1b2-4431-aa95-ce565893d47c'
    };

    const response = await client.createOrder(order, {
        'x-api-secret': 'test',
        'x-blockchain': 'rsk_testnet'
    });
    console.log('Data:', response);
}

async function testTakeOrder() {
    const takeOrderRequest: TakeSellOrderRequest = {
        type: "SELL",
        orderId: 'f18ffa7c-83bb-4b0c-a96c-e64c8f536c51', // Replace with a valid order ID
        userId: 'd41724af-aa3d-4184-8fa2-479db5f00660', // Replace with a valid user ID
        buyerAddress: '0x25DFBA06A227a6AAf5d29ED48437A23405F9FbFf',
        fiatAmount: "60000"
    };

    const response = await client.takeOrder(takeOrderRequest, {
        'x-api-secret': 'test',
        'x-blockchain': 'rsk_testnet'
    });
    console.log('Order Taken:', response);
}

async function testCreateUser() {
    const user: CreateUserRequest = {
        username: "username_test"
    }
    const response = await client.createUser(user);
}

async function testUpdateOrder() {
    const updateOrderRequest: UpdateOrderRequest = {
        status: 'FIAT_SENT',
        orderId: '643eac58-8dd4-44e5-99d4-fe779a581b58' // Replace with a valid order ID
    };

    const response = await client.updateOrder(updateOrderRequest, {
        'x-api-secret': 'test',
        'x-blockchain': 'rsk_testnet'
    });
    console.log('Order Updated:', response);
}


async function runTests() {

    // console.log('Testing Health Check...');
    // await runTest(testHealthCheck);

    // console.log('Testing Get Orders...');
    // await runTest(testGetOrders);

    // console.log('Testing Create Order...');
    // await runTest(testCreateOrder);

    // console.log('Testing Get Order By ID...');
    // await runTest(testGetOrderById);

    // console.log('Testing Take Order...');
    // await runTest(testTakeOrder);

    // console.log('Testing Create User...');
    // await runTest(testCreateUser);

    // console.log('Testing Update Order...');
    // await runTest(testUpdateOrder);

}

// runTests();