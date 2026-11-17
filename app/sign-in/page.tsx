import GoogleSignInButton from "@/components/google-sign-in";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function SignInBtn() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");

  return <GoogleSignInButton />;
}

export default function SigInPage() {
  return (
    <div>
      <Suspense fallback={<p>Loading</p>}>
        <SignInBtn />
      </Suspense>
    </div>
  );
}
