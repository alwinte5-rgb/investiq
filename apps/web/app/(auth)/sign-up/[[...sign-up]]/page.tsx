import { SignUp } from "@clerk/nextjs";

// force-dynamic: never statically prerendered (Clerk renders at request time only).
export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return <SignUp signInUrl="/sign-in" fallbackRedirectUrl="/dashboard" />;
}
