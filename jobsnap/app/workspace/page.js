"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function WorkspacePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("there");
  const [businessName, setBusinessName] = useState("");
  const [conversations, setConversations] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [initial, setInitial] = useState("J");

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/auth");
        return;
      }

      const [{ data: profile }, { data: business }, { data: chatRows }, { data: jobRows }] =
        await Promise.all([
          supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
          supabase
            .from("businesses")
            .select("business_name")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("conversations")
            .select("id,title,created_at")
            .eq("created_by", user.id)
            .order("created_at", { ascending: false })
            .limit(5),
          supabase
            .from("job_posts")
            .select("id,title,status,created_at")
            .eq("created_by", user.id)
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

      const name = profile?.full_name?.trim() || user.email?.split("@")[0] || "there";
      setUserName(name);
      setBusinessName(business?.[0]?.business_name || "");
      setConversations(chatRows ?? []);
      setJobs(jobRows ?? []);
      setInitial(name.charAt(0).toUpperCase());
      setLoading(false);
    };

    load();
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-sm text-zinc-600">
        Loading your workspace...
      </main>
    );
  }

  return (
    <main className="flex min-h-screen bg-white text-zinc-950">
      <aside className="hidden w-80 shrink-0 border-r border-zinc-200 bg-zinc-50 p-6 lg:flex lg:flex-col">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-brand">JobSnap</p>
            <p className="mt-1 text-xl font-semibold">Workspace</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
            {initial}
          </div>
        </div>

        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Previous chats
          </p>
          <div className="mt-3 space-y-2">
            {conversations.length ? (
              conversations.map((chat) => (
                <div key={chat.id} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                  <p className="text-sm font-medium">{chat.title || "Untitled chat"}</p>
                  <p className="mt-1 text-xs text-zinc-500">Saved work thread</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500">No previous chats yet.</p>
            )}
          </div>
        </div>

        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Recent work
          </p>
          <div className="mt-3 space-y-2">
            {jobs.length ? (
              jobs.map((job) => (
                <div key={job.id} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                  <p className="text-sm font-medium">{job.title || "Job post"}</p>
                  <p className="mt-1 text-xs text-zinc-500">{job.status || "draft"}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-500">No work yet.</p>
            )}
          </div>
        </div>
      </aside>

      <section className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-5 sm:px-10">
          <div>
            <p className="text-sm text-zinc-500">Welcome back</p>
            <h1 className="mt-1 font-display text-3xl">Hi {userName}, let&apos;s build your next post.</h1>
            {businessName ? <p className="mt-1 text-sm text-zinc-600">{businessName}</p> : null}
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
            {initial}
          </div>
        </header>

        <div className="grid flex-1 gap-6 px-6 py-8 sm:px-10 lg:grid-cols-[1.5fr_0.9fr]">
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6">
            <p className="text-sm font-medium text-brand">Getting started</p>
            <h2 className="mt-2 font-display text-2xl">Your workspace is ready</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              Upload a job photo, generate captions, and keep your drafts and chats here.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Activity
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-medium">Previous chats</p>
                <p className="text-sm text-zinc-600">{conversations.length} saved</p>
              </div>
              <div>
                <p className="text-sm font-medium">Recent work</p>
                <p className="text-sm text-zinc-600">{jobs.length} saved</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
