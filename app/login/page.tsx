"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import { loginUser, clearError } from "@/store/slices/userSlice";
import { AtSymbolIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();

  const { loading, error, success, isAuthenticated } = useSelector(
    (state: RootState) => state.user
  );

  const [form, setForm] = useState({ email: "", password: "" });

  useEffect(() => {
    if (error) toast.error(error);
    if (success) toast.success(success);
  }, [error, success]);

  useEffect(() => {
    if (isAuthenticated) router.push("/"); // ✅ Redirect after login
  }, [isAuthenticated, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) dispatch(clearError());
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.email.trim() || !form.password.trim()) {
      return toast.error("Email and Password are required");
    }

    dispatch(
      loginUser({ method: "email", email: form.email, password: form.password })
    );
  };

  return (
    <main className="min-h-screen bg-[#16351d] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white shadow-xl rounded-xl p-8 animate-fadeIn">
        <div className="w-full flex justify-center items-center">
          <img
            src="/images/logo-green.png"
            alt=""
            className="w-full max-w-[180px]"
          />
        </div>
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
          Antab ERP Login
        </h1>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <div className="relative">
              <AtSymbolIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 mt-1 border rounded-md focus:ring focus:ring-blue-300"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <LockClosedIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 mt-1 border rounded-md focus:ring focus:ring-blue-300"
                placeholder="Enter password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 text-white font-semibold rounded-md transition ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-[#3aa838] hover:bg-[#16351d]"
            }`}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          © {new Date().getFullYear()} All rights reserved & Copyright by
          Provati IT.
        </p>
      </div>
    </main>
  );
}
