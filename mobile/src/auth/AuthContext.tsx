
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';

import {
  login as loginRequest,
  setAuthToken,
  clearAuthToken,
  getCurrentUser,
} from '../api';

import {
  getToken,
  saveToken,
  removeToken,
} from './tokenStorage';

export type User = {
  id: number;
  name: string;
  email: string;
  role: 'adult' | 'parent' | 'doctor' | 'technician' | 'admin';
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore the saved authentication token when the app opens.
  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const savedToken = await getToken();

        if (savedToken && mounted) {
          // Restore the API authentication token first.
          setAuthToken(savedToken);
          setToken(savedToken);

          try {
            const response = await getCurrentUser();
            const restoredUser = response.data;

            if (
              restoredUser?.id &&
              restoredUser?.email &&
              restoredUser?.role
            ) {
              setUser(restoredUser as User);
            } else {
              await removeToken();
              clearAuthToken();
              setToken(null);
              setUser(null);
            }
          } catch (restoreError) {
            console.error(
              'Unable to restore the authenticated user:',
              restoreError
            );
            await removeToken();
            clearAuthToken();
            setToken(null);
            setUser(null);
          }
        }
      } catch (error) {
        console.error(
          'Session restoration failed:',
          error
        );

        if (mounted) {
          try {
            await removeToken();
          } catch (storageError) {
            console.error(
              'Unable to clear saved session:',
              storageError
            );
          }

          clearAuthToken();
          setToken(null);
          setUser(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      mounted = false;
    };
  }, []);

  // Authenticate the user.
  const login = useCallback(
    async (
      email: string,
      password: string
    ): Promise<User> => {
      const response = await loginRequest(
        email.trim(),
        password
      );

      const receivedToken = response.data?.token;
      const receivedUser = response.data?.user;

      if (
        !receivedToken ||
        !receivedUser?.id ||
        !receivedUser?.email ||
        !receivedUser?.role
      ) {
        throw new Error(
          'The server returned an incomplete login response.'
        );
      }

      // Save the token before allowing authenticated requests.
      await saveToken(receivedToken);

      setAuthToken(receivedToken);

      setToken(receivedToken);
      setUser(receivedUser as User);

      return receivedUser as User;
    },
    []
  );

  // Log out the user.
  const logout = useCallback(async () => {
    try {
      await removeToken();
    } catch (error) {
      console.error(
        'Unable to remove saved authentication token:',
        error
      );
    } finally {
      clearAuthToken();
      setToken(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token),
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Access authentication anywhere in the application.
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider.'
    );
  }

  return context;
}
