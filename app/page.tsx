import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session-server";
import { ROUTES } from "@/lib/auth/routes";

export default async function HomePage() {
  const user = await getSessionUser();
  redirect(user ? ROUTES.dashboard : ROUTES.login);
}
