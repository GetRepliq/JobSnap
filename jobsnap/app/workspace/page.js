"use client";

import Image from "next/image";
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
      <aside className="hidden w-72 shrink-0 border-r border-zinc-200 bg-white lg:flex lg:flex-col" />

      <section className="flex flex-1 flex-col">
        <header className="flex items-center justify-between px-8 pt-8 sm:px-12">
          <div>
            <p className="text-sm text-zinc-400">Personal Workspace</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
              Welcome Back {userName}
            </h1>
            {businessName ? (
              <p className="mt-1 text-sm text-zinc-500">{businessName}</p>
            ) : null}
          </div>

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-500 text-base font-semibold text-white">
            {initial}
          </div>
        </header>

        <div className="flex-1 px-4 py-10 sm:px-8 lg:px-12">
          <div className="relative mx-auto flex w-full max-w-[56rem] flex-col items-stretch justify-center overflow-hidden rounded-3xl px-4 py-20 text-center sm:px-6 sm:py-24">
            <Image
              src="/bg_elements.png"
              alt=""
              aria-hidden="true"
              fill
              className="object-cover object-center"
              priority
            />
            <div className="absolute inset-0 bg-white/10" />

            <div className="relative z-10 flex w-full flex-col items-center">
              <h2 className="font-display text-3xl font-bold text-zinc-950 sm:text-4xl">
                Let&apos;s build your next post
              </h2>

              <div className="mt-8 w-full max-w-[46rem] rounded-3xl bg-white p-5 text-left shadow-xl shadow-blue-900/10 sm:p-6">
                <textarea
                  rows={2}
                  placeholder="I just finished a new job building a pool, let's advertise the service benefits ..."
                  className="w-full resize-none border-none bg-transparent text-base text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-0"
                />
                <button
                  type="button"
                  className="mt-4 flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-base text-zinc-500">
                    +
                  </span>
                  Attach Image
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}