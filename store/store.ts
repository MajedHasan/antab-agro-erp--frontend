import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./slices/userSlice";

// Define the store with reducers
const store = configureStore({
  reducer: {
    user: userReducer,
  },
});

// Infer the `RootState` and `AppDispatch` types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
