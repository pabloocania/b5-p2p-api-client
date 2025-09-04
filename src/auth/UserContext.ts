// Define the User interface with basic properties
export interface User {
    id: string;
    username: string;
    email: string;
    idToken: string;
}

// Define the UserContext interface
export interface UserContext {
    user: User | null;
    setUser: (user: User | null) => void;
    updateUser: (updates: Partial<User>) => void;
    clearUser: () => void;
}

// Implement the UserContext class
export class UserContextImpl implements UserContext {
    private _user: User | null = null;

    get user(): User | null {
        return this._user;
    }

    setUser(user: User | null): void {
        this._user = user;
    }

    updateUser(updates: Partial<User>): void {
        if (this._user) {
            this._user = { ...this._user, ...updates };
        }
    }

    clearUser(): void {
        this._user = null;
    }
}

// Singleton instance of UserContext
export const userContext = new UserContextImpl();
