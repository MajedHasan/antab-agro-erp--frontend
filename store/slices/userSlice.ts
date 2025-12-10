import api from "@/lib/api";
import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import { getFriendlyAuthError } from "../../lib/authErrors";

export interface RoleShape {
  id: string;
  name: string;
  permissions: string[]; // ["sales.create", ...]
  isSystem?: boolean;
}

export interface User {
  id: string;
  email: string;
  role?: string | RoleShape; // backend may send role as string or populated object
  name?: string;
  profileImageUrl?: string;
  // option: add roles or permissions explicitly here if you want
}

export interface AuthPayload {
  user: User;
  accessToken: string;
}

export interface UserState {
  currentUser: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  success: string | null; // ✅ success messages
}

const storageUserKey = "currentUser";
const storageAccessKey = "accessToken";
const storageRefreshKey = "refreshToken";

/**
 * safeStorage - tiny wrapper around localStorage that no-ops on server.
 * Keeps your existing logic but prevents SSR crashes (localStorage undefined).
 */
const safeStorage = {
  get: (key: string): string | null =>
    typeof window === "undefined" ? null : localStorage.getItem(key),
  set: (key: string, value: string): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, value);
  },
  remove: (key: string): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(key);
  },
};

const getStoredUser = (): User | null => {
  const u = safeStorage.get(storageUserKey);
  return u ? JSON.parse(u) : null;
};

const initialState: UserState = {
  currentUser: getStoredUser(),
  accessToken: safeStorage.get(storageAccessKey),
  isAuthenticated: !!safeStorage.get(storageAccessKey),
  loading: false,
  error: null,
  success: null,
};

// ✅ Fetch current user from backend
export const fetchCurrentUser = createAsyncThunk<
  User,
  void,
  { rejectValue: string }
>("user/fetchCurrentUser", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get("/auth/me");
    return data.user;
  } catch (err: any) {
    return rejectWithValue("Session expired");
  }
});

// ✅ Bypass login in dev mode
export const bypassLogin = createAsyncThunk("user/bypassLogin", async () => {
  return {
    id: "dev-id",
    email: "dev@example.com",
    role: "admin",
    name: "Developer",
  } as User;
});

// --- LOGIN ---
export const loginUser = createAsyncThunk<
  AuthPayload & { message: string },
  { method: "email" | "google"; email?: string; password?: string },
  { rejectValue: string }
>("user/login", async (credentials, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/auth/login", {
      email: credentials.email,
      password: credentials.password,
    });

    safeStorage.set(storageUserKey, JSON.stringify(data.user));
    safeStorage.set(storageAccessKey, data.accessToken);
    safeStorage.set(storageRefreshKey, data.refreshToken);

    return { ...data, message: "Login successful" };
  } catch (err: any) {
    return rejectWithValue(
      getFriendlyAuthError(
        err.response?.data?.message || err.message || "Login failed"
      )
    );
  }
});

// --- REGISTER ---
export const registerUser = createAsyncThunk<
  any & { message: string },
  {
    method: "email" | "google";
    email?: string;
    password?: string;
    name?: string;
    role?: string;
  },
  { rejectValue: string }
>("user/register", async (newUser, { rejectWithValue }) => {
  try {
    const { data } = await api.post("/auth/register", {
      email: newUser.email,
      password: newUser.password || "firebase-google",
      name: newUser.name || newUser.name,
      role: newUser.role,
    });

    return { ...data, message: "Registration successful" };
  } catch (err: any) {
    return rejectWithValue(
      getFriendlyAuthError(
        err.response?.data?.message || err.message || "Registration failed"
      )
    );
  }
});

// --- LOGOUT ---
// In userSlice.ts
export const logoutUser = createAsyncThunk<
  { message: string },
  void,
  { rejectValue: string; state: { user: UserState } }
>("user/logout", async (_, { getState, rejectWithValue, dispatch }) => {
  try {
    // ✅ Check if bypass is enabled
    const BYPASS_AUTH = process.env.NEXT_PUBLIC_BYPASS_AUTH === "true";

    if (BYPASS_AUTH) {
      // In bypass mode, immediately re-login with dev credentials
      return { message: "Logout disabled in development mode" };
    }

    const state = getState();
    const { accessToken } = state.user;

    // await api.post("/auth/logout", { accessToken });

    safeStorage.remove(storageUserKey);
    safeStorage.remove(storageAccessKey);
    safeStorage.remove(storageRefreshKey);

    return { message: "Logout successful" };
  } catch (err: any) {
    return rejectWithValue(
      getFriendlyAuthError(
        err.response?.data?.message || err.message || "Logout failed"
      )
    );
  }
});

// --- SLICE ---
const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    clearAuth: (state) => {
      state.currentUser = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
      state.success = null;
      safeStorage.remove(storageUserKey);
      safeStorage.remove(storageAccessKey);
    },
    clearError: (state) => {
      state.error = null;
      state.success = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = null;
      })
      .addCase(
        loginUser.fulfilled,
        (state, action: PayloadAction<AuthPayload & { message: string }>) => {
          state.currentUser = action.payload.user;
          state.accessToken = action.payload.accessToken;
          state.isAuthenticated = true;
          state.loading = false;
          state.success = action.payload.message;
        }
      )
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Login failed";
        state.success = null;
      })
      // Register
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = null;
      })
      .addCase(
        registerUser.fulfilled,
        (state, action: PayloadAction<any & { message: string }>) => {
          state.loading = false;
          state.success = action.payload.message;
        }
      )
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Registration failed";
        state.success = null;
      })
      // Logout
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = null;
      })
      .addCase(
        logoutUser.fulfilled,
        (state, action: PayloadAction<{ message: string }>) => {
          const BYPASS_AUTH = process.env.NEXT_PUBLIC_BYPASS_AUTH === "true";

          if (BYPASS_AUTH) {
            // Don't clear state in bypass mode
            state.success = action.payload.message;
            return;
          }

          // Normal logout flow
          state.currentUser = null;
          state.accessToken = null;
          state.isAuthenticated = false;
          state.loading = false;
          state.error = null;
          state.success = action.payload.message;
        }
      )
      .addCase(logoutUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Logout failed";
        state.success = null;
      })
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.currentUser = action.payload;
        state.isAuthenticated = true;
        state.loading = false;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.loading = false;
        // state.isAuthenticated = false;
      })
      .addCase(bypassLogin.fulfilled, (state, action) => {
        state.currentUser = action.payload;
        state.isAuthenticated = true;
        state.loading = false;
      });
  },
});

export const { clearAuth, clearError } = userSlice.actions;
export default userSlice.reducer;
