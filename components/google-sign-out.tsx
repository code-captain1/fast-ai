"use client";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export default function GoogleSignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        authClient.signOut({
          fetchOptions: { onSuccess: () => router.replace("/sign-in") },
        });
      }}
    >
      Sign Out
    </button>
  );
}
