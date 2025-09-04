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
    Auth
} from "firebase/auth";
import { getMessaging, getToken, onMessage, MessagePayload } from "firebase/messaging";
import { CreateUserRequest, KioscoinUser } from "../types";
import P2PMarketplaceAPIClient from "../P2PMarketplaceAPIClient";
import { FirebaseLoginServiceConfig, LoginService } from "./LoginService";
import { userContext } from './UserContext';


// Auth provider type for better type safety
export enum AuthProvider {
    EMAIL = 'EMAIL',
    GOOGLE = 'GOOGLE',
    FACEBOOK = 'FACEBOOK',
    TWITTER = 'TWITTER'
}

// Immutable auth state class
export class AuthState {
    private constructor(
        public readonly isAuthenticated: boolean,
        public readonly user: UserData | null,
        public readonly provider: AuthProvider | null
    ) { }

    static authenticated(user: UserData, provider: AuthProvider): AuthState {
        return new AuthState(true, user, provider);
    }

    static unauthenticated(): AuthState {
        return new AuthState(false, null, null);
    }
}

// Enhanced UserData class with additional safety
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

export class FirebaseUnifiedService implements LoginService {
    private app: ReturnType<typeof initializeApp> | null = null;
    private messaging: ReturnType<typeof getMessaging> | null = null;
    private auth: Auth | null = null;
    private readonly actionCodeSettings: { url: string; handleCodeInApp: boolean };
    private client: P2PMarketplaceAPIClient;

    constructor(client: P2PMarketplaceAPIClient, config?: FirebaseLoginServiceConfig) {
        this.client = client;
        this.actionCodeSettings = config?.actionCodeSettings ?? {
            url: 'http://localhost:3000/auth/verify-email',
            handleCodeInApp: true,
        };
        this.initializeFirebase();
    }

    private async initializeFirebase() {
        try {
            const firebaseConfig = await this.fetchFirebaseConfig();
            this.app = initializeApp(firebaseConfig);
            this.auth = getAuth(this.app);
        } catch (error) {
            console.error("Failed to initialize Firebase app:", error);
        }
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
            if (!this.auth) {
                console.error("Firebase Auth not initialized");
                return AuthResult.failure("Firebase Auth not initialized");
            }
            const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
            const idToken = await userCredential.user.getIdToken();
            const backendUser = await this.getUserFromBackend(userCredential.user.uid, idToken);

            if (backendUser) {
                const authResult = this._createSuccessAuthResult(userCredential.user, backendUser, AuthProvider.EMAIL, idToken);
                // Update UserContext
                userContext.setUser({
                    id: userCredential.user.uid,
                    username: backendUser.username || '',
                    email: userCredential.user.email || '',
                    idToken: idToken,
                    isAdmin: backendUser.admin || false
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
            if (!this.auth) {
                return AuthResult.failure("Firebase Auth not initialized");
            }

            // First create the user in Firebase
            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            const user = userCredential.user;
            const idToken = await user.getIdToken();
            // Send email verification
            await sendEmailVerification(user);

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
            if (!this.auth) {
                return AuthResult.failure("Firebase Auth not initialized");
            }

            const provider = new GoogleAuthProvider();
            const userCredential = await signInWithPopup(this.auth, provider);
            const user = userCredential.user;

            // Get or create user in your Kotlin backend
            const backendUser = await this.getUserFromBackend(user.uid, user.displayName || '');
            const idToken = await user.getIdToken();
            if (backendUser) {
                // Use the new helper method
                return this._createSuccessAuthResult(user, backendUser, AuthProvider.GOOGLE, idToken);
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
            if (!this.auth) {
                return AuthResult.failure("Firebase Auth not initialized");
            }

            const provider = new FacebookAuthProvider();
            const userCredential = await signInWithPopup(this.auth, provider);
            const user = userCredential.user;

            // Get or create user in your Kotlin backend
            const backendUser = await this.getUserFromBackend(user.uid, user.displayName || '');
            const idToken = await user.getIdToken();
            if (backendUser) {
                // Use the new helper method
                return this._createSuccessAuthResult(user, backendUser, AuthProvider.FACEBOOK, idToken);
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
            if (!this.auth) {
                return AuthResult.failure("Firebase Auth not initialized");
            }

            const provider = new TwitterAuthProvider();
            const userCredential = await signInWithPopup(this.auth, provider);
            const user = userCredential.user;

            // Get or create user in your Kotlin backend
            const backendUser = await this.getUserFromBackend(user.uid, user.displayName || '');
            const idToken = await user.getIdToken();
            if (backendUser) {
                // Use the new helper method
                return this._createSuccessAuthResult(user, backendUser, AuthProvider.TWITTER, idToken);
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
            if (!this.auth) {
                return false;
            }

            const user = this.auth.currentUser;
            if (user) {
                await sendEmailVerification(user);
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
            if (!this.auth) {
                return false;
            }

            await sendPasswordResetEmail(this.auth, email);
            return true;
        } catch (error) {
            console.error('Error sending password reset email:', error);
            return false;
        }
    }

    async signOut(): Promise<void> {
        try {
            if (!this.auth) {
                return;
            }

            await signOut(this.auth);
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
            if (!this.auth) {
                return false;
            }

            await sendSignInLinkToEmail(this.auth, email, this.actionCodeSettings);
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
            if (!this.auth) {
                return AuthResult.failure("Firebase Auth not initialized");
            }

            if (!this.isSignInWithEmailLink()) {
                return AuthResult.failure("Invalid sign-in link");
            }

            const userCredential = await signInWithEmailLink(this.auth, email, window.location.href);
            const user = userCredential.user;

            // Clear the email from localStorage
            window.localStorage.removeItem('emailForSignIn');

            // Get or create user in your Kotlin backend
            const backendUser = await this.getUserFromBackend(user.uid, user.displayName || '');
            const idToken = await user.getIdToken();
            if (backendUser) {
                // Use the new helper method
                return this._createSuccessAuthResult(user, backendUser, AuthProvider.EMAIL, idToken);
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
    private async getUserFromBackend(userId: string, loginId: string): Promise<KioscoinUser | null> {
        try {
            const response = await this.client.getUser(userId, {
                Authorization: `Bearer ${loginId}`,
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
}
