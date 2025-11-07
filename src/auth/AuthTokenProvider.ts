export interface AuthTokenProvider {
    getToken(): Promise<string | null>;
    refreshToken(): Promise<string | null>;
    onRefreshFailure?(error: unknown): void;
}
