import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";
// const API_BASE =
//   process.env.NEXT_PUBLIC_API_URL || "http://192.168.0.229:5001/api";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // Important for cookies
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// response interceptor for refresh
let isRefreshing = false;
let pendingRequests: ((token?: string) => void)[] = [];

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    const status = err.response?.status;
    if (status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken =
        typeof window !== "undefined"
          ? localStorage.getItem("refreshToken")
          : null;
      if (!refreshToken) {
        // give up
        return Promise.reject(err);
      }

      if (isRefreshing) {
        // queue request until refresh done
        return new Promise((resolve, reject) => {
          pendingRequests.push((token?: string) => {
            if (!token) return reject(err);
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      try {
        isRefreshing = true;
        const { data } = await axios.post(`${API_BASE}/auth/refresh`, {
          refreshToken,
        });
        const { accessToken: newAccess, refreshToken: newRefresh } = data;
        localStorage.setItem("accessToken", newAccess);
        localStorage.setItem("refreshToken", newRefresh);

        // resolve queued
        pendingRequests.forEach((cb) => cb(newAccess));
        pendingRequests = [];
        return api({
          ...original,
          headers: {
            ...original.headers,
            Authorization: `Bearer ${newAccess}`,
          },
        });
      } catch (e) {
        // refresh failed, clear storage
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        pendingRequests.forEach((cb) => cb());
        pendingRequests = [];
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(err);
  },
);

export default api;
