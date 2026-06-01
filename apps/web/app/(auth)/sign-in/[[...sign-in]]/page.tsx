import { SignIn } from "@clerk/nextjs";

// force-dynamic: never statically prerendered, so Clerk only renders at request
// time (the build-time prerender that crashed never touches this page).
export const dynamic = "force-dynamic";

export default function SignInPage() {
  return <SignIn signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />;
}
