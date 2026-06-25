"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
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
  const [attachedImage, setAttachedImage] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generationResult, setGenerationResult] = useState(null);
  const [composerError, setComposerError] = useState("");
  const fileInputRef = useRef(null);

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

  useEffect(() => {
    return () => {
      if (attachedImage?.previewUrl) {
        URL.revokeObjectURL(attachedImage.previewUrl);
      }
    };
  }, [attachedImage]);

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (attachedImage?.previewUrl) {
      URL.revokeObjectURL(attachedImage.previewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    setAttachedImage({
      file,
      previewUrl,
    });
  };

  const removeImage = () => {
    if (attachedImage?.previewUrl) {
      URL.revokeObjectURL(attachedImage.previewUrl);
    }

    setAttachedImage(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setComposerError("");

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/auth");
        return;
      }

      const formData = new FormData();
      formData.append("prompt", prompt);

      if (attachedImage?.file) {
        formData.append("image", attachedImage.file);
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to generate post.");
      }

      setGenerationResult(payload);
    } catch (error) {
      setComposerError(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

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

              <form
                onSubmit={handleSubmit}
                className="mt-8 w-full max-w-[46rem] rounded-3xl bg-white p-5 text-left shadow-xl shadow-blue-900/10 sm:p-6"
              >
                {attachedImage ? (
                  <div className="mb-4 flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-2.5">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white">
                      <img
                        src={attachedImage.previewUrl}
                        alt={attachedImage.file.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-zinc-900">
                        {attachedImage.file.name}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {Math.round(attachedImage.file.size / 1024)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={removeImage}
                      className="rounded-full px-2.5 py-1 text-xs text-zinc-500 hover:bg-white hover:text-zinc-900"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}

                <textarea
                  rows={2}
                  placeholder="I just finished a new job building a pool, let's advertise the service benefits ..."
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  className="w-full resize-none border-none bg-transparent text-base text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-0"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleAttachClick}
                    className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-base text-zinc-500">
                      +
                    </span>
                    Attach Image
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting || (!prompt.trim() && !attachedImage)}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Generate post"
                  >
                    {isSubmitting ? (
                      <span className="text-sm">...</span>
                    ) : (
                      <span className="text-lg leading-none">→</span>
                    )}
                  </button>
                </div>

                {composerError ? (
                  <p className="mt-3 text-sm text-red-600">{composerError}</p>
                ) : null}
              </form>
            </div>

            {generationResult ? (
              <div className="mt-6 w-full max-w-[46rem] rounded-3xl border border-zinc-200 bg-white p-5 text-left shadow-sm sm:p-6">
                <p className="text-sm font-medium text-brand">Generated output</p>
                <div className="mt-4 space-y-4">
                  {generationResult.generation?.captions?.map((item, index) => (
                    <div
                      key={`${index}-${item.caption?.slice(0, 12) ?? index}`}
                      className={`rounded-2xl border p-4 ${
                        index === generationResult.generation.best_caption_index
                          ? "border-brand bg-brand/5"
                          : "border-zinc-200 bg-zinc-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-zinc-900">
                          Caption {index + 1}
                        </p>
                        {index === generationResult.generation.best_caption_index ? (
                          <span className="rounded-full bg-brand px-2 py-1 text-xs font-medium text-white">
                            Best
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-zinc-700">
                        {item.caption}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.hashtags?.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-white px-3 py-1 text-xs text-zinc-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}