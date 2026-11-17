"use client";
import { authClient } from "@/lib/auth-client";

export default function GoogleSignInButton() {
  return (
    <button
      onClick={() => {
        authClient.signIn.social({
          provider: "google",
          callbackURL: "/dashboard",
        });
      }}
    >
      Continue with Google
    </button>
  );
}
