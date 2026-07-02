/**
 * The single source of truth for page content width, padding, and vertical
 * rhythm. Edit these classes here to change the frame of every screen at once.
 */
export function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex max-w-none flex-col gap-4 px-8 pb-8 pt-4">{children}</div>
  );
}
