import { AxiosError } from 'axios';

/**
 * Validation error codes returned by the backend API.
 * These correspond to the ValidationError enum in the Kotlin backend.
 */
export type ValidationError =
    // Order creation errors
    | 'USER_HAS_ACTIVE_ORDERS_AS_CREATOR'
    | 'USER_HAS_TOO_MANY_PENDING_ORDERS'
    | 'ORDER_AMOUNT_TOO_LOW'
    | 'ORDER_AMOUNT_TOO_HIGH'
    // Order taking errors
    | 'USER_HAS_ACTIVE_ORDERS'
    // Order cancellation errors
    | 'ORDER_NOT_FOUND'
    | 'ORDER_CANCELLATION_NOT_ALLOWED'
    // Generic
    | 'INVALID_REQUEST';

/**
 * Structure of the error response from the backend API.
 */
export interface ApiErrorResponse {
    message: string;
    code?: number;
    error?: ValidationError;
}

/**
 * Type guard to check if an error response has a validation error.
 */
export function hasValidationError(error: ApiErrorResponse): error is ApiErrorResponse & { error: ValidationError } {
    return error.error !== undefined;
}

/**
 * Parses an error (typically from an axios request) into a typed ApiErrorResponse.
 * This is a non-breaking helper that works with existing error handling code.
 * 
 * @param error - The error to parse (usually from a catch block)
 * @returns ApiErrorResponse with extracted message, code, and error type
 * 
 * @example
 * ```typescript
 * try {
 *     await client.createOrder(order, headers);
 * } catch (err) {
 *     const apiError = parseApiError(err);
 *     if (apiError.error === 'ORDER_AMOUNT_TOO_LOW') {
 *         // Show specific message for this error
 *     }
 * }
 * ```
 */
export function parseApiError(error: unknown): ApiErrorResponse {
    // Handle axios errors with response data
    if (isAxiosError(error) && error.response?.data) {
        const data = error.response.data as ApiErrorResponse;
        return {
            message: data.message || error.message,
            code: data.code,
            error: data.error
        };
    }

    // Handle standard Error objects
    if (error instanceof Error) {
        return { message: error.message };
    }

    // Handle string errors
    if (typeof error === 'string') {
        return { message: error };
    }

    // Fallback for unknown error types
    return { message: 'An unexpected error occurred' };
}

/**
 * Type guard to check if an error is an AxiosError.
 */
function isAxiosError(error: unknown): error is AxiosError {
    return (
        error !== null &&
        typeof error === 'object' &&
        'isAxiosError' in error &&
        (error as AxiosError).isAxiosError === true
    );
}
