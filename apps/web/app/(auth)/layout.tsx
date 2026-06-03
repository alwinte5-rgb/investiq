// The ClerkProvider lives at the root layout now; this group just centers the
// Clerk <SignIn>/<SignUp> widgets (each page is force-dynamic).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[60vh] items-center justify-center">{children}</div>;
}
