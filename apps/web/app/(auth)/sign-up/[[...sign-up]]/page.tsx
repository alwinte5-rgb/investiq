// Sign-ups closed 2026-07-23: this is now a single-user personal tool, not a
// public product. The Clerk <SignUp> widget is intentionally not rendered
// here so the app can never hand out a new account, regardless of Clerk's
// own dashboard restriction setting (belt-and-suspenders — set that too).
export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold">Sign-ups are closed</h1>
      <p className="mt-3 text-sm text-slate-600">
        This is a personal tool and isn&apos;t accepting new accounts.
      </p>
    </div>
  );
}
