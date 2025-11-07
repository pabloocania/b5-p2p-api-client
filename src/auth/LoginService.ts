import P2PMarketplaceAPIClient from "../P2PMarketplaceAPIClient";
import { AuthResult, FirebaseService } from "./FirebaseLoginService";

export type LoginProvider = 'firebase' | 'custom';

export interface LoginService {
    signInWithEmail(email: string, password: string): Promise<AuthResult>;
    createUserWithEmail(email: string, password: string, username: string): Promise<AuthResult>;
    sendPasswordResetEmail(email: string): Promise<boolean>;
    signOut(): Promise<void>;
}

export interface LoginServiceConfig {
    provider: LoginProvider;
    apiClient: P2PMarketplaceAPIClient;
    firebase?: FirebaseLoginServiceConfig;
}

export interface FirebaseLoginServiceConfig {
    actionCodeSettings?: {
        url: string;
        handleCodeInApp: boolean;
    };
    emailVerificationUrl?: string;
    emailVerificationContinueUrl?: string;
}

export function createLoginService(config: LoginServiceConfig): LoginService {
    const { provider, apiClient } = config;
    if (provider === 'firebase') {
        return new FirebaseService(apiClient, config.firebase);
    }
    throw new Error(`Unsupported login provider: ${provider}`);
}


