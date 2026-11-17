import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import GoogleSignOutButton from "@/components/google-sign-out";

async function Account() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/sign-in");
    const { user } = await session;

    return (
      <div>
        {user.image && <img src={user.image} alt="Profile" />}
        <h1>{user.name}</h1>
        <p>{user.email}</p>
      </div>
    );
  } catch (error) {
    console.log(error);
    return <div></div>;
  }
}

export default function Dashboard() {
  return (
    <div>
      <h1>Your Account</h1>
      <Suspense fallback={<p>Loading</p>}>
        <Account />
      </Suspense>
      <GoogleSignOutButton />
    </div>
  );
}
