// src/lib/authErrors.ts
import { AxiosError } from "axios";

/**
 * Normalize Firebase / API / unknown errors into user-friendly strings.
 */
export function getFriendlyAuthError(err: any): string {
  // 1) Axios / backend errors that include a message
  if (err?.isAxiosError) {
    const axiosErr = err as AxiosError;
    const serverMsg =
      (axiosErr.response && (axiosErr.response.data as any)?.message) ||
      (axiosErr.response && (axiosErr.response.data as any)?.error) ||
      axiosErr.message;
    return serverMsg || "Server error. Please try again.";
  }

  // 2) FirebaseError has .code like "auth/user-not-found"
  if (err && typeof err === "object" && "code" in err) {
    const code: string = (err as any).code;
    switch (code) {
      // sign in / sign up
      case "auth/user-not-found":
        return "No account found for that email. Please sign up first.";
      case "auth/wrong-password":
        return "Incorrect password. Please try again.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/email-already-in-use":
        return "This email is already in use. Try signing in instead.";
      case "auth/weak-password":
        return "Password is too weak. Use at least 6 characters.";
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request":
        return "Sign-in was cancelled. Please try again.";
      case "auth/popup-blocked":
        return "Popup blocked. Allow popups or try again.";
      case "auth/invalid-credential":
        return "Authentication failed. Please try again.";
      case "auth/account-exists-with-different-credential":
        return "An account exists with a different sign-in method. Try another option.";
      case "auth/user-disabled":
        return "This account has been disabled. Contact support.";
      case "auth/network-request-failed":
        return "Network error. Check your connection and try again.";
      case "auth/requires-recent-login":
        return "Please re-authenticate and try again.";
      default:
        // If firebase message is verbose, try to extract short code
        return formatUnknownError(err);
    }
  }

  // 3) If error is a string like "Firebase: Error (auth/invalid-credential)."
  if (typeof err === "string") {
    // try to extract the code between parentheses
    const m = err.match(/\(([^)]+)\)/);
    if (m?.[1]) {
      const code = m[1];
      // fallback to returning a friendlier sentence (strip "auth/" prefix if present)
      return code.replace(/^auth\//, "").replace(/-/g, " ") + ".";
    }
    return err;
  }

  // 4) Fallback
  if (err?.message) return err.message;
  return "Something went wrong. Please try again.";
}

function formatUnknownError(err: any) {
  // If firebase error has message, try shorten it
  const msg = (err && err.message) || String(err);
  // Remove "Firebase: Error" part to avoid leaking raw prefix
  return msg.replace(/^Firebase:\s*Error\s*/i, "").trim();
}
