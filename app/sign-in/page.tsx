// app/sign-in/page.tsx  (server component — no "use client")
import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import SignInClient from "@/components/sign-in-client";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: true },
};

async function SignInGate() {
  const session = await auth.api.getSession({ headers: await headers() });

  // Already signed in -> never show the sign-in page
  if (session) redirect("/dashboard");

  return <SignInClient />;
}

export default function SignInRoute() {
  return (
    // fallback={null}: nothing flashes while we check the session
    <Suspense fallback={null}>
      <SignInGate />
    </Suspense>
  );
}