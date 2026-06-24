export async function getUserDestination(supabase, userId) {
  const [{ data: profile, error: profileError }, { data: business, error: businessError }] =
    await Promise.all([
      supabase.from("profiles").select("id").eq("id", userId).maybeSingle(),
      supabase.from("businesses").select("id").eq("owner_id", userId).maybeSingle(),
    ]);

  if (profileError) {
    throw profileError;
  }

  if (businessError) {
    throw businessError;
  }

  return profile && business ? "/workspace" : "/onboarding";
}
