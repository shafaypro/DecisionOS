import { redirect } from "next/navigation";

// /dashboard merged into /decisions. Kept as a redirect for old bookmarks and
// any external (e.g. Slack digest) links.
export default function DashboardPage() {
  redirect("/decisions");
}
