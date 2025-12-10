"use client";

import { Provider } from "react-redux";
import { ReactNode } from "react";
import store from "../store/store"; // adjust if your store path differs

export function ReduxProvider({ children }: { children: ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}
