import { ClerkProvider } from "@clerk/nextjs";

// ClerkProvider for the sign-in / sign-up pages only. These pages are
// force-dynamic (see each page.tsx), so Clerk renders at request time and is
// never part of the build-time static prerender — keeping the build safe.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <div className="flex min-h-[60vh] items-center justify-center">{children}</div>
    </ClerkProvider>
  );
}
