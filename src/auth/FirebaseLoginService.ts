import { initializeApp } from "firebase/app";
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    signOut,
    User,
    GoogleAuthProvider,
    FacebookAuthProvider,
    TwitterAuthProvider,
    signInWithPopup,
    isSignInWithEmailLink,
    sendSignInLinkToEmail,
    signInWithEmailLink,
    Auth,
    applyActionCode
} from "firebase/auth";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { CreateUserRequest, KioscoinUser, UpdateUserSettingsRequest } from "../types";
import P2PMarketplaceAPIClient from "../P2PMarketplaceAPIClient";
import { AuthTokenProvider } from "./AuthTokenProvider";
import { FirebaseLoginServiceConfig, LoginService } from "./LoginService";
import { userContext } from './UserContext';


const DEFAULT_EMAIL_VERIFICATION_PAGE =
    process.env.NEXT_PUBLIC_EMAIL_VERIFICATION_URL ??
    "http://localhost:3000/auth/email-verified";

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const appendQueryParams = (
    base: string,
    params: Record<string, string | undefined>
): string => {
    const query = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`)
        .join("&");

    if (!query) {
        return base;
    }

    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}${query}`;
};


// Auth provider type for better type safety
export enum AuthProvider {
    EMAIL = 'EMAIL',
    GOOGLE = 'GOOGLE',
    FACEBOOK = 'FACEBOOK',
    TWITTER = 'TWITTER'
}

export class UserData {
    private constructor(
        public readonly id: string,
        public readonly email: string,
        public readonly username: string,
        public readonly isEmailVerified: boolean,
        public readonly idToken: string | null,
        public readonly isAdmin: boolean
    ) { }

    static create(
        id: string,
        email: string,
        username: string,
        isEmailVerified: boolean,
        idToken: string | null,
        isAdmin: boolean
    ): UserData {
        return new UserData(
            id,
            email,
            username,
            isEmailVerified,
            idToken,
            isAdmin
        );
    }

    withEmailVerified(): UserData {
        return new UserData(
            this.id,
            this.email,
            this.username,
            true,
            this.idToken,
            this.isAdmin
        );
    }
}

// Enhanced AuthResult class
export class AuthResult {
    private constructor(
        public readonly success: boolean,
        public readonly user: KioscoinUser | null,
        public readonly userData: UserData | null,
        public readonly error: string | null,
        public readonly provider: AuthProvider | null,
        public readonly isAdmin: boolean
    ) { }

    static success(user: KioscoinUser, userData: UserData, provider: AuthProvider): AuthResult {
        return new AuthResult(true, user, userData, null, provider, userData.isAdmin);
    }

    static failure(error: string): AuthResult {
        return new AuthResult(false, null, null, error, null, false);
    }
}

export interface FirebaseConfig {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
}

export class FirebaseService implements LoginService {
    private app: ReturnType<typeof initializeApp> | null = null;
    private messaging: ReturnType<typeof getMessaging> | null = null;
    private auth: Auth | null = null;
    private readonly actionCodeSettings: { url: string; handleCodeInApp: boolean };
    private readonly emailVerificationUrl: string;
    private readonly emailVerificationContinueUrl?: string;
    private client: P2PMarketplaceAPIClient;
    private readonly initializationPromise: Promise<void>;

    constructor(backendClient: P2PMarketplaceAPIClient, firebaseLoginConfig?: FirebaseLoginServiceConfig) {
        this.client = backendClient;
        const fallbackVerificationPage = firebaseLoginConfig?.emailVerificationUrl ?? DEFAULT_EMAIL_VERIFICATION_PAGE;
        this.emailVerificationUrl = trimTrailingSlash(fallbackVerificationPage);
        this.emailVerificationContinueUrl = firebaseLoginConfig?.emailVerificationContinueUrl;
        const configuredActionSettings = firebaseLoginConfig?.actionCodeSettings;
        const defaultActionUrl =
            configuredActionSettings?.url ??
            process.env.REACT_APP_EMAIL_LINK_URL ??
            process.env.NEXT_PUBLIC_EMAIL_LINK_URL

        this.actionCodeSettings = {
            url: defaultActionUrl ?? "http://localhost:3000/auth/verify-email",
            handleCodeInApp: configuredActionSettings?.handleCodeInApp ?? true,
        };

        // Set the auth token provider first (before initialization)
        // It will gracefully return null until auth is ready
        this.client.setAuthTokenProvider(this.buildAuthTokenProvider());

        // Start initialization (this will fetch config, which needs to work without auth)
        this.initializationPromise = this.initializeFirebase();
    }

    private async initializeFirebase() {
        if (this.app) {
            return;
        }
        try {
            const firebaseConfig = await this.fetchFirebaseConfig();
            this.app = initializeApp(firebaseConfig);
            this.auth = getAuth(this.app);
        } catch (error) {
            console.error("Failed to initialize Firebase app:", error);
        }
    }

    private async ensureAuthInstance(): Promise<Auth | null> {
        try {
            await this.initializationPromise;
        } catch (_error) {
            return null;
        }

        return this.auth;
    }

    private buildAuthTokenProvider(): AuthTokenProvider {
        return {
            getToken: async () => {
                // Check if auth is available without waiting for initialization
                // This prevents circular dependency during initial config fetch
                if (!this.auth) {
                    return null;
                }
                const currentUser = this.auth.currentUser;
                if (!currentUser) {
                    return null;
                }
                return currentUser.getIdToken();
            },
            refreshToken: async () => {
                // For token refresh, we need to ensure auth is initialized
                const auth = await this.ensureAuthInstance();
                const currentUser = auth?.currentUser;
                if (!currentUser) {
                    return null;
                }
                const refreshedToken = await currentUser.getIdToken(true);
                userContext.updateUser({ idToken: refreshedToken });
                return refreshedToken;
            },
            onRefreshFailure: (error) => {
                console.error("Failed to refresh Firebase ID token:", error);
            }
        };
    }

    private async fetchFirebaseConfig(): Promise<FirebaseConfig> {
        try {
            const response = await this.client.getConfig<{ firebase: FirebaseConfig }>();
            return response.config.firebase;
        } catch (error) {
            console.error("Error fetching Firebase configuration:", error);
            throw new Error("Failed to initialize Firebase configuration");
        }
    }

    private buildEmailVerificationSettings(loginId: string) {
        return {
            url: this.buildEmailVerificationUrl(loginId),
            handleCodeInApp: false,
        };
    }

    private buildEmailVerificationUrl(loginId: string): string {
        return appendQueryParams(this.emailVerificationUrl, {
            loginId,
            continueUrl: this.emailVerificationContinueUrl,
        });
    }

    private async ensureBackendVerification(
        firebaseUser: User,
        backendUser: KioscoinUser,
        idToken: string
    ): Promise<KioscoinUser> {
        const firebaseVerified = firebaseUser.emailVerified;
        const backendVerified = backendUser.settings?.hasVerified ?? false;

        if (!firebaseVerified || backendVerified) {
            return backendUser;
        }

        if (!backendUser.id) {
            console.warn("Missing backend user id when attempting to mark verification status.");
            return backendUser;
        }

        const settingsUpdate: UpdateUserSettingsRequest["settings"] = {
            paymentMethods: (backendUser.settings?.paymentMethods ?? []).map((method) => ({ ...method })),
            hasVerified: true,
        };

        const preferredToken = backendUser.settings?.preferredTokenCode;
        if (preferredToken !== undefined && preferredToken !== null) {
            settingsUpdate.preferredTokenCode = preferredToken;
        }

        const request: UpdateUserSettingsRequest = {
            userId: backendUser.id,
            settings: settingsUpdate,
        };

        try {
            const response = await this.client.updateUserSettings(request, {
                Authorization: `Bearer ${idToken}`,
            });
            return response.users?.[0] ?? backendUser;
        } catch (error) {
            console.error("Failed to update backend verification status:", error);
            return backendUser;
        }
    }

    // Messaging methods
    public async requestNotificationPermission(): Promise<string | null> {
        if (!this.app) {
            await this.initializeFirebase();
        }

        if (!this.messaging) {
            console.warn("Messaging is not available");
            return null;
        }

        try {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
                const token = await getToken(this.messaging, {
                    vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY,
                });
                return token;
            }
            return null;
        } catch (error) {
            console.error("Failed to get notification token:", error);
            return null;
        }
    }
    async fetchToken(): Promise<string | null> {
        try {
            if (!this.messaging && this.app) {
                this.messaging = getMessaging(this.app);
            }
            if (this.messaging) {
                const currentToken = await getToken(this.messaging);
                return currentToken;
            }
            return null;
        } catch (error) {
            console.error("An error occurred while retrieving token. ", error);
            return null;
        }
    }

    onMessageListener(callback: (payload: any) => void) {
        if (!this.messaging && this.app) {
            this.messaging = getMessaging(this.app);
        }
        if (this.messaging) {
            onMessage(this.messaging, callback);
        } else {
            console.error("Messaging is not initialized.");
        }
    }

    // Authentication methods
    async signInWithEmail(email: string, password: string): Promise<AuthResult> {
        try {
            const auth = await this.ensureAuthInstance();
            if (!auth) {
                console.error("Firebase Auth not initialized");
                return AuthResult.failure("Firebase Auth not initialized");
            }
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const idToken = await userCredential.user.getIdToken();
            const backendUser = await this.getUserFromBackend(userCredential.user.uid, idToken);

            if (backendUser) {
                const syncedBackendUser = await this.ensureBackendVerification(
                    userCredential.user,
                    backendUser,
                    idToken
                );
                const authResult = this._createSuccessAuthResult(
                    userCredential.user,
                    syncedBackendUser,
                    AuthProvider.EMAIL,
                    idToken
                );
                // Update UserContext
                userContext.setUser({
                    id: userCredential.user.uid,
                    username: syncedBackendUser.username || '',
                    email: userCredential.user.email || '',
                    idToken,
                    isAdmin: syncedBackendUser.admin || false,
                    isEmailVerified: userCredential.user.emailVerified
                });
                return authResult;
            } else {
                return AuthResult.failure('User not found in backend');
            }
        } catch (error: any) {
            console.error('Detailed error signing in with email:', {
                code: error.code,
                message: error.message,
                fullError: error
            });
            return AuthResult.failure(error.message || 'Authentication failed');
        }
    }

    async createUserWithEmail(email: string, password: string, username: string): Promise<AuthResult> {
        try {
            const auth = await this.ensureAuthInstance();
            if (!auth) {
                return AuthResult.failure("Firebase Auth not initialized");
            }

            // First create the user in Firebase
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            const idToken = await user.getIdToken();
            // Send email verification
            await sendEmailVerification(user, this.buildEmailVerificationSettings(user.uid));

            const backendUser = await this.createUserInBackend(user.uid, username, idToken);

            if (backendUser) {
                return this._createSuccessAuthResult(user, backendUser, AuthProvider.EMAIL, idToken);
            } else {
                return AuthResult.failure('Failed to create user in backend');
            }
        } catch (error: any) {
            console.error('Error creating user with email:', error);
            return AuthResult.failure(error.message || 'User creation failed');
        }
    }

    async signInWithGoogle(): Promise<AuthResult> {
        try {
            const auth = await this.ensureAuthInstance();
            if (!auth) {
                return AuthResult.failure("Firebase Auth not initialized");
            }

            const provider = new GoogleAuthProvider();
            const userCredential = await signInWithPopup(auth, provider);
            const user = userCredential.user;
            const idToken = await user.getIdToken();

            const backendUser = await this.getOrCreateUserInBackend(user, idToken);
            if (backendUser) {
                const syncedBackendUser = await this.ensureBackendVerification(user, backendUser, idToken);
                return this._createSuccessAuthResult(user, syncedBackendUser, AuthProvider.GOOGLE, idToken);
            } else {
                return AuthResult.failure('Failed to get or create user in backend');
            }
        } catch (error: any) {
            console.error('Error signing in with Google:', error);
            return AuthResult.failure(error.message || 'Google authentication failed');
        }
    }

    async signInWithFacebook(): Promise<AuthResult> {
        try {
            const auth = await this.ensureAuthInstance();
            if (!auth) {
                return AuthResult.failure("Firebase Auth not initialized");
            }

            const provider = new FacebookAuthProvider();
            const userCredential = await signInWithPopup(auth, provider);
            const user = userCredential.user;
            const idToken = await user.getIdToken();

            // Get or create user in your Kotlin backend
            const backendUser = await this.getUserFromBackend(user.uid, idToken);
            if (backendUser) {
                const syncedBackendUser = await this.ensureBackendVerification(user, backendUser, idToken);
                // Use the new helper method
                return this._createSuccessAuthResult(user, syncedBackendUser, AuthProvider.FACEBOOK, idToken);
            } else {
                return AuthResult.failure('Failed to get or create user in backend');
            }
        } catch (error: any) {
            console.error('Error signing in with Facebook:', error);
            return AuthResult.failure(error.message || 'Facebook authentication failed');
        }
    }

    async signInWithTwitter(): Promise<AuthResult> {
        try {
            const auth = await this.ensureAuthInstance();
            if (!auth) {
                return AuthResult.failure("Firebase Auth not initialized");
            }

            const provider = new TwitterAuthProvider();
            const userCredential = await signInWithPopup(auth, provider);
            const user = userCredential.user;
            const idToken = await user.getIdToken();

            // Get or create user in your Kotlin backend
            const backendUser = await this.getUserFromBackend(user.uid, idToken);
            if (backendUser) {
                const syncedBackendUser = await this.ensureBackendVerification(user, backendUser, idToken);
                // Use the new helper method
                return this._createSuccessAuthResult(user, syncedBackendUser, AuthProvider.TWITTER, idToken);
            } else {
                return AuthResult.failure('Failed to get or create user in backend');
            }
        } catch (error: any) {
            console.error('Error signing in with Twitter:', error);
            return AuthResult.failure(error.message || 'Twitter authentication failed');
        }
    }

    async sendEmailVerification(): Promise<boolean> {
        try {
            const auth = await this.ensureAuthInstance();
            if (!auth) {
                return false;
            }

            const user = auth.currentUser;
            if (user) {
                await sendEmailVerification(user, this.buildEmailVerificationSettings(user.uid));
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error sending email verification:', error);
            return false;
        }
    }

    async sendPasswordResetEmail(email: string): Promise<boolean> {
        try {
            const auth = await this.ensureAuthInstance();
            if (!auth) {
                return false;
            }

            await sendPasswordResetEmail(auth, email);
            return true;
        } catch (error) {
            console.error('Error sending password reset email:', error);
            return false;
        }
    }

    async signOut(): Promise<void> {
        try {
            const auth = await this.ensureAuthInstance();
            if (!auth) {
                userContext.clearUser();
                return;
            }

            await signOut(auth);
            // Clear UserContext
            userContext.clearUser();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    }

    getCurrentUser(): User | null {
        if (!this.auth) {
            return null;
        }
        return this.auth.currentUser;
    }

    async sendSignInLinkToEmail(email: string): Promise<boolean> {
        try {
            const auth = await this.ensureAuthInstance();
            if (!auth) {
                return false;
            }

            await sendSignInLinkToEmail(auth, email, this.actionCodeSettings);
            // Save the email locally to use it later when the user clicks the link
            window.localStorage.setItem('emailForSignIn', email);
            return true;
        } catch (error: any) {
            console.error('Error sending sign-in link to email:', error);
            return false;
        }
    }

    isSignInWithEmailLink(): boolean {
        if (!this.auth) {
            return false;
        }
        return isSignInWithEmailLink(this.auth, window.location.href);
    }

    async signInWithEmailLink(email: string): Promise<AuthResult> {
        try {
            const auth = await this.ensureAuthInstance();
            if (!auth) {
                return AuthResult.failure("Firebase Auth not initialized");
            }

            if (!isSignInWithEmailLink(auth, window.location.href)) {
                return AuthResult.failure("Invalid sign-in link");
            }

            const userCredential = await signInWithEmailLink(auth, email, window.location.href);
            const user = userCredential.user;

            // Clear the email from localStorage
            window.localStorage.removeItem('emailForSignIn');

            const idToken = await user.getIdToken();

            // Get or create user in your Kotlin backend
            const backendUser = await this.getUserFromBackend(user.uid, idToken);
            if (backendUser) {
                const syncedBackendUser = await this.ensureBackendVerification(user, backendUser, idToken);
                // Use the new helper method
                return this._createSuccessAuthResult(user, syncedBackendUser, AuthProvider.EMAIL, idToken);
            } else {
                return AuthResult.failure('Failed to get or create user in backend');
            }
        } catch (error: any) {
            console.error('Error signing in with email link:', error);
            return AuthResult.failure(error.message || 'Email link authentication failed');
        }
    }

    getEmailForSignIn(): string | null {
        return window.localStorage.getItem('emailForSignIn');
    }

    async applyEmailVerificationCode(oobCode: string): Promise<void> {
        const auth = await this.ensureAuthInstance();
        if (!auth) {
            throw new Error("Firebase Auth not initialized");
        }

        await applyActionCode(auth, oobCode);
    }

    // Helper method to create success AuthResult
    private _createSuccessAuthResult(
        user: User,
        backendUser: KioscoinUser,
        provider: AuthProvider,
        idToken: string
    ): AuthResult {
        const userData = UserData.create(
            user.uid,
            user.email || '',
            backendUser.username || '',
            user.emailVerified,
            idToken,
            backendUser.admin || false
        );
        return AuthResult.success(backendUser, userData, provider);
    }

    // Backend integration methods
    private async getUserFromBackend(userId: string, authToken: string): Promise<KioscoinUser | null> {
        try {
            const response = await this.client.getUser(userId, {
                Authorization: `Bearer ${authToken}`,
            });
            return response.users[0];
        } catch (error) {
            console.error('Error getting user from backend:', error);
            return null;
        }
    }

    private async createUserInBackend(userId: string, username: string, idToken: string): Promise<KioscoinUser | null> {
        try {
            const createUserRequest: CreateUserRequest = {
                id: userId,
                username: username
            }
            const response = await this.client.createUser(createUserRequest, {
                Authorization: `Bearer ${idToken}`
            });
            return response.users[0];
        } catch (error) {
            console.error('Error creating user in backend:', error);
            return null;
        }
    }

    private async getOrCreateUserInBackend(
        user: User,
        idToken: string
    ): Promise<KioscoinUser | null> {
        // Try to get existing user from backend
        const existingUser = await this.getUserFromBackend(user.uid, idToken);
        if (existingUser) {
            return existingUser;
        }

        // User doesn't exist, create them (first-time social sign-in)
        const username = user.email?.split('@')[0]
            || `user_${user.uid.substring(0, 8)}`;

        return this.createUserInBackend(user.uid, username, idToken);
    }
}
