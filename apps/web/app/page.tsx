import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

/** Minimal personal entry — this is not a product landing page. Signed-in
 * (i.e. the owner) goes straight to the dashboard; anyone else sees a plain
 * locked door. */
export default async function Home() {
  // (auth() throws in guest mode, where clerkMiddleware doesn't run.)
  const userId = await auth()
    .then((a) => a.userId)
    .catch(() => null);
  if (userId) redirect("/dashboard");
  const guestMode = process.env.GUEST_MODE === "true";

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <p className="text-3xl font-semibold tracking-tight">
            Invest<span className="text-cyan-500">IQ</span>
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            Personal trading command center — quant bots, options, futures, forex.
          </p>
        </div>
        <Link
          href={guestMode ? "/dashboard" : "/sign-in"}
          className="inline-block w-full rounded-md bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500"
        >
          {guestMode ? "Open dashboard" : "Sign in"}
        </Link>
        <p className="text-xs text-neutral-600">Private instance — sign-ups are closed.</p>
      </div>
    </div>
  );
}
