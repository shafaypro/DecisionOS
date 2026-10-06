import { LogoMark, Wordmark } from "@/components/ui/logo";
import { Text } from "@/components/ui/text";

/** The centered logo + white card frame shared by the sign-in style pages. */
export function AuthCard({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden px-4"
      style={{ background: "var(--gradient-ink)" }}
    >
      <div className="relative w-full max-w-md animate-enter">
        <div className="text-center mb-8">
          <div className="mb-4 inline-flex justify-center">
            <LogoMark size={56} />
          </div>
          <Wordmark size="3xl" />
          <Text as="p" className="mt-2 text-slate-300">{subtitle}</Text>
        </div>
        <div className="rounded-xs bg-white p-8 shadow-soft">{children}</div>
      </div>
    </div>
  );
}
