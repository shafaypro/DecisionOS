/**
 * The single source of truth for page content width, padding, and vertical
 * rhythm. Edit these classes here to change the frame of every screen at once.
 * Below `lg` the top padding clears the floating navigation button.
 */
export function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex max-w-none flex-col gap-4 px-4 pb-8 pt-16 sm:px-8 lg:pt-4">{children}</div>
  );
}
