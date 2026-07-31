import { GlossaryProvider } from "@/components/term";
import { SidebarNav } from "@/components/sidebar-nav";

/** Authed shell: sidebar rail (desktop) / nav strip (mobile) + content area.
 * The ClerkProvider + account menu live in the root layout header. */
export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <GlossaryProvider>
      <div className="flex min-h-full flex-col lg:flex-row">
        <SidebarNav />
        <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </div>
      </div>
    </GlossaryProvider>
  );
}
