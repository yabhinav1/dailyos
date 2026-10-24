import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminMusicClient from "./admin-music-client";

export default async function AdminMusicPage() {
  const session = await auth();

  // Redirect rather than render an "access denied" page for non-admins —
  // this avoids even confirming to a logged-in non-admin that this route
  // exists and is meaningful.
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/today");
  }

  return <AdminMusicClient />;
}
