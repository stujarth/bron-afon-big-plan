import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BigPlan from "@/components/BigPlan";
import type { Profile, Project, Team } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: teams }, { data: projects }, { data: profile }] = await Promise.all([
    supabase.from("teams").select("*").order("sort_order"),
    supabase.from("projects_with_teams").select("*"),
    supabase.from("profiles").select("id,email,full_name,role,onboarded_at").eq("id", user.id).maybeSingle(),
  ]);

  return (
    <BigPlan
      initialTeams={(teams ?? []) as Team[]}
      initialProjects={(projects ?? []) as Project[]}
      profile={(profile ?? { id: user.id, email: user.email ?? "", full_name: null, role: "viewer" }) as Profile}
    />
  );
}
