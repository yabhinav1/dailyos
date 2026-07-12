import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import GuestNotesPage from "@/components/guest/guest-notes-page";

export default async function Home() {
  const session = await auth();

  // Logged-in users land on the full, database-backed Notes experience.
  if (session?.user) {
    redirect("/notes");
  }

  // Guests get a lightweight notes + doodle experience that saves
  // to this browser's localStorage until they sign in.
  return <GuestNotesPage />;
}
