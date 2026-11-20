// components/dashboard-header.tsx
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import GoogleSignOutButton from "@/components/google-sign-out";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  );
}

// Validates the session and shows who is signed in.
async function AccountMenu() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const { user } = session;

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="flex items-center gap-3">
        <Avatar className="size-9 ring-2 ring-blue-50">
          {user.image && (
            <AvatarImage
              src={user.image}
              alt={`${user.name}'s profile`}
              referrerPolicy="no-referrer"
            />
          )}
          <AvatarFallback className="bg-blue-50 text-sm font-semibold text-blue-700">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="hidden min-w-0 md:block">
          <p className="max-w-44 truncate text-sm font-semibold leading-tight text-gray-900">
            {user.name}
          </p>
          <p className="max-w-44 truncate text-xs leading-tight text-gray-500">
            {user.email}
          </p>
        </div>
      </div>

      <div className="h-6 w-px bg-gray-200" />

      <GoogleSignOutButton />
    </div>
  );
}

function AccountMenuSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="size-9 rounded-full" />
      <div className="hidden space-y-1.5 md:block">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-36" />
      </div>
    </div>
  );
}

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand (renders instantly, no session needed) */}
        <Link href="/dashboard" aria-label="KineticClips AI home">
          <Image
            src="/kineticclips-logo.svg"
            alt="KineticClips AI"
            width={163}
            height={32}
            priority
            className="h-8 w-auto"
          />
        </Link>

        {/* Account */}
        <Suspense fallback={<AccountMenuSkeleton />}>
          <AccountMenu />
        </Suspense>
      </div>
    </header>
  );
}