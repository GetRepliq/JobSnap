"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { useIsMobile } from "../../lib/hooks/use-is-mobile";
import MobilePostFlow from "./mobile-post-flow";

export default function WorkspacePage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("there");
  const [businessName, setBusinessName] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [conversations, setConversations] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [initial, setInitial] = useState("J");
  const [attachedImage, setAttachedImage] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generationResult, setGenerationResult] = useState(null);
  const [composerError, setComposerError] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [loadingConversationId, setLoadingConversationId] = useState(null);
  const fileInputRef = useRef(null);
  const resultsRef = useRef(null);

  const captions = generationResult?.generation?.captions ?? [];
  const bestCaptionIndex = generationResult?.generation?.best_caption_index ?? 0;

  function formatConversationDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "Today";
    }

    if (diffDays === 1) {
      return "Yesterday";
    }

    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  async function loadConversation(conversationId) {
    setLoadingConversationId(conversationId);
    setComposerError("");

    try {
      const supabase = createClient();
      const { data: messages, error } = await supabase
        .from("messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      const userMessage = messages?.find((message) => message.role === "user");
      const assistantMessage = messages?.find((message) => message.role === "assistant");

      let generation = null;
      let extraction = null;

      if (assistantMessage?.content) {
        try {
          const parsed = JSON.parse(assistantMessage.content);
          generation = parsed.generation ?? null;
          extraction = parsed.extraction ?? null;
        } catch {
          throw new Error("Could not read this conversation.");
        }
      }

      const userPrompt =
        userMessage?.content === "Image analysis request" ? "" : userMessage?.content ?? "";

      const loaded = {
        conversationId,
        generation,
        extraction,
        prompt: userPrompt,
      };

      setSelectedConversationId(conversationId);
      setPrompt(userPrompt);
      setGenerationResult({
        conversationId,
        generation,
        extraction,
      });

      if (attachedImage?.previewUrl) {
        URL.revokeObjectURL(attachedImage.previewUrl);
      }
      setAttachedImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      return loaded;
    } catch (error) {
      setComposerError(
        error instanceof Error ? error.message : "Could not load conversation."
      );
      throw error;
    } finally {
      setLoadingConversationId(null);
    }
  }

  function handleConversationCreated(payload) {
    setGenerationResult(payload);
    setSelectedConversationId(payload.conversationId ?? null);

    if (payload.conversationId) {
      const title =
        payload.generation?.captions?.[0]?.caption?.slice(0, 80) ||
        prompt.slice(0, 80) ||
        "New post";

      setConversations((previous) => [
        {
          id: payload.conversationId,
          title,
          created_at: new Date().toISOString(),
        },
        ...previous.filter((chat) => chat.id !== payload.conversationId),
      ]);
    }
  }

  function handleNewPost() {
    setSelectedConversationId(null);
    setGenerationResult(null);
    setPrompt("");
    setComposerError("");
    removeImage();
  }

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
            .select("business_name, instagram_handle")
            .eq("owner_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("conversations")
            .select("id,title,created_at")
            .eq("created_by", user.id)
            .order("created_at", { ascending: false })
            .limit(30),
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
      setInstagramHandle(business?.[0]?.instagram_handle || "");
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
        credentials: "include",
        method: "POST",
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to generate post.");
      }

      setGenerationResult(payload);
      setSelectedConversationId(payload.conversationId ?? null);

      if (payload.conversationId) {
        const title =
          payload.generation?.captions?.[0]?.caption?.slice(0, 80) ||
          prompt.slice(0, 80) ||
          "New post";

        setConversations((previous) => [
          {
            id: payload.conversationId,
            title,
            created_at: new Date().toISOString(),
          },
          ...previous.filter((chat) => chat.id !== payload.conversationId),
        ]);
      }

      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (error) {
      setComposerError(
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isMobile === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-sm text-zinc-600">
        Loading your workspace...
      </main>
    );
  }

  if (isMobile) {
    return (
      <MobilePostFlow
        instagramHandle={instagramHandle}
        conversations={conversations}
        loadingConversationId={loadingConversationId}
        onConversationCreated={handleConversationCreated}
        onLoadConversation={loadConversation}
        onReset={handleNewPost}
        initialGeneration={
          selectedConversationId ? generationResult?.generation ?? null : null
        }
        initialConversationId={selectedConversationId}
        initialPrompt={prompt}
      />
    );
  }

  return (
    <main className="flex min-h-screen bg-white text-zinc-950">
      <aside className="hidden w-72 shrink-0 border-r border-zinc-200 bg-white lg:flex lg:flex-col">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-5">
          <p className="text-sm font-semibold text-zinc-900">Past chats</p>
          <button
            type="button"
            onClick={handleNewPost}
            className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-200"
          >
            + New
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {conversations.length === 0 ? (
            <p className="px-2 py-4 text-xs leading-5 text-zinc-500">
              No conversations yet. Generate your first post to see it here.
            </p>
          ) : (
            <ul className="space-y-1">
              {conversations.map((chat) => {
                const isSelected = selectedConversationId === chat.id;
                const isLoading = loadingConversationId === chat.id;

                return (
                  <li key={chat.id}>
                    <button
                      type="button"
                      onClick={() => loadConversation(chat.id)}
                      disabled={isLoading}
                      className={`w-full rounded-xl px-3 py-2.5 text-left transition disabled:opacity-60 ${
                        isSelected
                          ? "bg-brand/10 ring-1 ring-brand/20"
                          : "hover:bg-zinc-50"
                      }`}
                    >
                      <p
                        className={`truncate text-sm font-medium ${
                          isSelected ? "text-zinc-900" : "text-zinc-700"
                        }`}
                      >
                        {chat.title?.trim() || "Untitled post"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-400">
                        {isLoading ? "Loading…" : formatConversationDate(chat.created_at)}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
      </aside>

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
          <div className="relative mx-auto w-full max-w-[56rem] overflow-hidden rounded-3xl px-4 py-16 text-center sm:px-6 sm:py-20">
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
          </div>

          {isSubmitting ? (
            <div className="mx-auto mt-8 w-full max-w-[46rem] rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
                <p className="text-sm font-medium text-zinc-700">
                  Analyzing your image and writing captions…
                </p>
              </div>
              <div className="mt-4 space-y-3">
                <div className="h-16 rounded-2xl bg-zinc-100 animate-pulse" />
                <div className="h-16 rounded-2xl bg-zinc-100 animate-pulse" />
                <div className="h-16 rounded-2xl bg-zinc-100 animate-pulse" />
              </div>
            </div>
          ) : null}

          {generationResult ? (
            <div
              ref={resultsRef}
              className="mx-auto mt-8 w-full max-w-[46rem] scroll-mt-8"
            >
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-brand">Your post options</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Pick a caption below — the highlighted one is our top pick.
                    </p>
                  </div>
                  {generationResult.conversationId ? (
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500">
                      Saved to history
                    </span>
                  ) : null}
                </div>

                {captions.length > 0 ? (
                  <div className="mt-5 space-y-4">
                    {captions.map((item, index) => {
                      const isBest = index === bestCaptionIndex;
                      const hashtagText = (item.hashtags ?? [])
                        .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
                        .join(" ");
                      const copyText = [item.caption, hashtagText]
                        .filter(Boolean)
                        .join("\n\n");

                      return (
                        <div
                          key={`${index}-${item.caption?.slice(0, 12) ?? index}`}
                          className={`rounded-2xl border p-4 sm:p-5 ${
                            isBest
                              ? "border-brand bg-brand/5 ring-1 ring-brand/20"
                              : "border-zinc-200 bg-zinc-50"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-zinc-900">
                                Caption {index + 1}
                              </p>
                              {isBest ? (
                                <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-white">
                                  Top pick
                                </span>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(copyText)}
                              className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
                            >
                              Copy
                            </button>
                          </div>

                          {item.angle ? (
                            <p className="mt-2 text-xs text-zinc-500">{item.angle}</p>
                          ) : null}

                          <p className="mt-3 text-sm leading-7 text-zinc-800">
                            {item.caption}
                          </p>

                          {item.hashtags?.length ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {item.hashtags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-white px-3 py-1 text-xs text-zinc-600 ring-1 ring-zinc-200"
                                >
                                  {tag.startsWith("#") ? tag : `#${tag}`}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-zinc-500">
                    Generation completed but no captions were returned. Try submitting again.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}