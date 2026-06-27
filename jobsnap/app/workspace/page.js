"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import {
  buildCaptionText,
  copyTextToClipboard,
  downloadImage,
  formatHashtag,
  getPlatformLabel,
  resolveShareImage,
  sharePostToPlatform,
} from "../../lib/post-actions";
import { useIsMobile } from "../../lib/hooks/use-is-mobile";
import MobilePostFlow from "./mobile-post-flow";

const GENERATION_ERROR_MESSAGE =
  "Something went wrong on our end. Please try uploading the image again!";

function getGenerationErrorMessage(payload, response) {
  if (response.status === 401) {
    return "Please sign in again to continue.";
  }

  if (response.status === 402 || response.status === 429) {
    return payload?.error || GENERATION_ERROR_MESSAGE;
  }

  if (response.status >= 400 && response.status < 500 && payload?.error) {
    return payload.error;
  }

  return payload?.error || GENERATION_ERROR_MESSAGE;
}

function applyUsageUpdate(setFreePostsRemaining, usage) {
  if (usage?.free_posts_remaining !== undefined) {
    setFreePostsRemaining(usage.free_posts_remaining);
  }
}

export default function WorkspacePage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [userName, setUserName] = useState("there");
  const [businessName, setBusinessName] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [freePostsRemaining, setFreePostsRemaining] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [initial, setInitial] = useState("J");
  const [attachedImage, setAttachedImage] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generationResult, setGenerationResult] = useState(null);
  const [composerError, setComposerError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [selectedCaptionIndex, setSelectedCaptionIndex] = useState(0);
  const [captionDrafts, setCaptionDrafts] = useState({});
  const [selectedHashtagSelections, setSelectedHashtagSelections] = useState({});
  const [copiedCaptionIndex, setCopiedCaptionIndex] = useState(null);
  const [loadingConversationId, setLoadingConversationId] = useState(null);
  const fileInputRef = useRef(null);
  const resultsRef = useRef(null);
  const copiedCaptionTimeoutRef = useRef(null);

  const captions = generationResult?.generation?.captions ?? [];
  const bestCaptionIndex = generationResult?.generation?.best_caption_index ?? 0;
  const selectedCaption =
    captions[selectedCaptionIndex] ?? captions[bestCaptionIndex] ?? captions[0] ?? null;
  const selectedCaptionText =
    captionDrafts[selectedCaptionIndex] ?? selectedCaption?.caption ?? "";
  const selectedHashtags =
    selectedHashtagSelections[selectedCaptionIndex] ??
    selectedCaption?.hashtags ??
    [];
  const selectedHashtagText = selectedHashtags.map(formatHashtag).join(" ");
  const selectedCaptionCopyText = buildCaptionText(
    selectedCaptionText,
    selectedHashtags
  );
  const imageSourceUrl = generationResult?.jobImage?.imageUrl ?? null;
  const activeImage = attachedImage?.file
    ? {
        file: attachedImage.file,
        url: attachedImage.previewUrl,
        name: attachedImage.file.name,
      }
    : imageSourceUrl
      ? {
          file: null,
          url: imageSourceUrl,
          name:
            generationResult?.jobImage?.storage_path_original?.split("/").pop() ??
            "job-image.jpg",
        }
      : null;
  const usageSummary =
    generationResult?.usage?.free_posts_remaining !== undefined
      ? generationResult.usage
      : freePostsRemaining !== null
        ? { free_posts_remaining: freePostsRemaining }
        : null;

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

  function syncCaptionDrafts(generation) {
    const captionsList = generation?.captions ?? [];
    const nextDrafts = {};
    const nextHashtags = {};

    captionsList.forEach((item, index) => {
      nextDrafts[index] = item.caption ?? "";
      nextHashtags[index] = item.hashtags ?? [];
    });

    setCaptionDrafts(nextDrafts);
    setSelectedHashtagSelections(nextHashtags);
    setSelectedCaptionIndex(generation?.best_caption_index ?? 0);
    setCopiedCaptionIndex(null);
  }

  function applyGenerationPayload(payload) {
    setGenerationResult(payload);
    setSelectedConversationId(payload.conversationId ?? null);
    syncCaptionDrafts(payload.generation);
    setActionMessage("");
  }

  function toggleSelectedHashtag(index, hashtag) {
    const currentTags =
      selectedHashtagSelections[index] ??
      captions[index]?.hashtags ??
      [];
    const normalizedHashtag = formatHashtag(hashtag);
    const nextTags = currentTags.some(
      (tag) => formatHashtag(tag) === normalizedHashtag
    )
      ? currentTags.filter((tag) => formatHashtag(tag) !== normalizedHashtag)
      : [...currentTags, normalizedHashtag];

    setSelectedHashtagSelections((previous) => ({
      ...previous,
      [index]: nextTags,
    }));
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
      let jobImage = null;

      if (assistantMessage?.content) {
        try {
          const parsed = JSON.parse(assistantMessage.content);
          generation = parsed.generation ?? null;
          extraction = parsed.extraction ?? null;
          jobImage = parsed.jobImageUrl
            ? {
                imageUrl: parsed.jobImageUrl,
                storage_path_original: parsed.jobImageStoragePath ?? null,
              }
            : null;
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
        jobImage,
      };

      setSelectedConversationId(conversationId);
      setPrompt(userPrompt);
      const loadedResult = {
        conversationId,
        generation,
        extraction,
        jobImage,
      };
      setGenerationResult(loadedResult);
      syncCaptionDrafts(generation);
      setActionMessage("");

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
    applyGenerationPayload(payload);

    if (payload.conversationId) {
      const title =
        payload.generation?.captions?.[payload.generation?.best_caption_index ?? 0]
          ?.caption?.slice(0, 80) ||
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
    setActionMessage("");
    setCaptionDrafts({});
    setSelectedHashtagSelections({});
    setSelectedCaptionIndex(0);
    setCopiedCaptionIndex(null);
    removeImage();
  }

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      try {
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
              .select("id, business_name, instagram_handle")
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

        const businessRow = business?.[0];
        let usageRow = null;

        if (businessRow?.id) {
          const { data, error: usageError } = await supabase
            .from("usage")
            .select("free_posts_remaining, posts_used")
            .eq("business_id", businessRow.id)
            .maybeSingle();

          if (usageError) {
            throw usageError;
          }

          usageRow = data;
        }

        const name = profile?.full_name?.trim() || user.email?.split("@")[0] || "there";
        setUserName(name);
        setBusinessName(businessRow?.business_name || "");
        setInstagramHandle(businessRow?.instagram_handle || "");
        setFreePostsRemaining(usageRow?.free_posts_remaining ?? 20);
        setConversations(chatRows ?? []);
        setJobs(jobRows ?? []);
        setInitial(name.charAt(0).toUpperCase());
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "We couldn't load your workspace. Please refresh and try again."
        );
      } finally {
        setLoading(false);
      }
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

  useEffect(() => {
    return () => {
      if (copiedCaptionTimeoutRef.current) {
        clearTimeout(copiedCaptionTimeoutRef.current);
      }
    };
  }, []);

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

  const handleGenerate = async (event) => {
    event?.preventDefault?.();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setComposerError("");
    setActionMessage("");

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

      const imageFile = attachedImage?.file
        ? attachedImage.file
        : generationResult?.jobImage?.imageUrl
          ? await resolveShareImage({
              imageUrl: generationResult.jobImage.imageUrl,
              fallbackName:
                generationResult?.jobImage?.storage_path_original?.split("/").pop() ??
                "job-image.jpg",
            })
          : null;

      const formData = new FormData();
      formData.append("prompt", prompt);

      if (imageFile) {
        formData.append("image", imageFile);
      }

      const response = await fetch("/api/generate", {
        credentials: "include",
        method: "POST",
        body: formData,
      });

      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }

      if (!response.ok) {
        applyUsageUpdate(setFreePostsRemaining, payload?.usage);
        throw new Error(getGenerationErrorMessage(payload, response));
      }

      applyUsageUpdate(setFreePostsRemaining, payload?.usage);
      applyGenerationPayload(payload);

      if (payload.conversationId) {
        const title =
          payload.generation?.captions?.[payload.generation?.best_caption_index ?? 0]
            ?.caption?.slice(0, 80) ||
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
        error instanceof Error ? error.message : GENERATION_ERROR_MESSAGE
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  async function handleCaptionCopy(mode) {
    if (!selectedCaptionCopyText) {
      return;
    }

    const payload =
      mode === "hashtags"
        ? selectedHashtagText
        : mode === "all"
          ? selectedCaptionCopyText
          : selectedCaptionText;

    if (!payload) {
      return;
    }

    await copyTextToClipboard(payload);
    setActionMessage(
      mode === "hashtags"
        ? "Hashtags copied."
        : mode === "all"
          ? "Caption and hashtags copied."
          : "Caption copied."
    );
  }

  async function handleDownloadCurrentImage() {
    if (!activeImage) {
      setActionMessage("No image available to download.");
      return;
    }

    await downloadImage({
      imageFile: activeImage.file,
      imageUrl: activeImage.url,
      fallbackName: activeImage.name || "job-image.jpg",
    });
    setActionMessage("Image download started.");
  }

  async function handlePlatformHandoff(platform) {
    if (!selectedCaptionCopyText) {
      setActionMessage("Add a caption first.");
      return;
    }

    try {
      await sharePostToPlatform({
        platform,
        captionText: selectedCaptionCopyText,
        imageFile: activeImage?.file,
        imageUrl: activeImage?.url,
        fallbackName: activeImage?.name || "job-image.jpg",
        useNativeShare: isMobile && typeof navigator.share === "function",
      });
      setActionMessage(`${getPlatformLabel(platform)} handoff prepared.`);
    } catch (error) {
      setActionMessage(
        error instanceof Error
          ? error.message
          : `Could not prepare ${getPlatformLabel(platform)}.`
      );
    }
  }

  async function handleRegenerate() {
    await handleGenerate();
  }

  if (loading || isMobile === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-sm text-zinc-600">
        Loading your workspace...
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="max-w-md text-center">
          <p className="text-sm font-medium text-zinc-900">Couldn&apos;t load your workspace</p>
          <p className="mt-2 text-sm text-zinc-500">{loadError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (isMobile) {
    return (
      <MobilePostFlow
        instagramHandle={instagramHandle}
        conversations={conversations}
        freePostsRemaining={freePostsRemaining}
        onUsageUpdate={setFreePostsRemaining}
        loadingConversationId={loadingConversationId}
        onConversationCreated={handleConversationCreated}
        onLoadConversation={loadConversation}
        onReset={handleNewPost}
        onGenerationUpdate={applyGenerationPayload}
        selectedCaptionIndex={selectedCaptionIndex}
        captionDrafts={captionDrafts}
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
                onSubmit={handleGenerate}
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
                    className="flex items-center gap-2 text-sm text-zinc-500 transition-all duration-200 hover:-translate-y-0.5 hover:text-zinc-700"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-base text-zinc-500">
                      +
                    </span>
                    Attach Image
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting || (!prompt.trim() && !attachedImage)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-base text-zinc-500 transition-all duration-200 hover:-translate-y-0.5 hover:bg-zinc-200 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Generate post"
                  >
                    {isSubmitting ? (
                      <span className="text-xs leading-none">…</span>
                    ) : (
                      <span className="leading-none">→</span>
                    )}
                  </button>
                </div>

                {freePostsRemaining !== null ? (
                  <p className="mt-3 text-center text-xs text-zinc-400">
                    {freePostsRemaining} free {freePostsRemaining === 1 ? "post" : "posts"} left
                  </p>
                ) : null}

                {composerError ? (
                  <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
                    {composerError}
                  </p>
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
                      Pick a caption below, then refine it before handing it off.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {usageSummary?.free_posts_remaining !== undefined ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                        {usageSummary.free_posts_remaining} free posts left
                      </span>
                    ) : null}
                    {generationResult.conversationId ? (
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-500">
                        Saved to history
                      </span>
                    ) : null}
                  </div>
                </div>

                {captions.length > 0 ? (
                  <div className="mt-5 space-y-4">
                    {captions.map((item, index) => {
                      const isBest = index === bestCaptionIndex;
                      const isSelected = index === selectedCaptionIndex;
                      const copyText = buildCaptionText(item.caption, item.hashtags);
                      const captionHashtags = item.hashtags ?? [];
                      const selectedTagsForCard =
                        selectedHashtagSelections[index] ?? captionHashtags;

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
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  await copyTextToClipboard(copyText);
                                  setCopiedCaptionIndex(index);
                                  setActionMessage(`Caption ${index + 1} copied.`);

                                  if (copiedCaptionTimeoutRef.current) {
                                    clearTimeout(copiedCaptionTimeoutRef.current);
                                  }

                                  copiedCaptionTimeoutRef.current = setTimeout(() => {
                                    setCopiedCaptionIndex((current) =>
                                      current === index ? null : current
                                    );
                                  }, 1400);
                                }}
                                className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                                  copiedCaptionIndex === index
                                    ? "border border-emerald-500 bg-emerald-500 text-white"
                                    : "border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
                                }`}
                              >
                                {copiedCaptionIndex === index ? "Copied" : "Copy"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedCaptionIndex(index)}
                                className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                                  isSelected
                                    ? "bg-brand text-white"
                                    : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:ring-zinc-300"
                                }`}
                              >
                                {isSelected ? "Selected" : "Use this"}
                              </button>
                            </div>
                          </div>

                          {item.angle ? (
                            <p className="mt-2 text-xs text-zinc-500">{item.angle}</p>
                          ) : null}

                          {isSelected ? (
                            <textarea
                              rows={5}
                              style={{ fontSize: "14px", lineHeight: "1.575rem" }}
                              value={captionDrafts[index] ?? item.caption ?? ""}
                              onChange={(event) =>
                                setCaptionDrafts((previous) => ({
                                  ...previous,
                                  [index]: event.target.value,
                                }))
                              }
                              className="mt-3 w-full resize-none border-none bg-transparent p-0 text-sm leading-[1.575rem] text-zinc-800 focus:outline-none focus:ring-0 max-h-[120px] overflow-y-auto"
                            />
                          ) : (
                            <p className="mt-3 text-sm leading-[1.575rem] text-zinc-800">
                              {item.caption}
                            </p>
                          )}

                          {item.hashtags?.length ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {captionHashtags.map((tag) => {
                                const isTagSelected = selectedTagsForCard.some(
                                  (selectedTag) =>
                                    formatHashtag(selectedTag) === formatHashtag(tag)
                                );

                                return (
                                  <button
                                    key={tag}
                                    type="button"
                                    style={{ fontSize: "13px" }}
                                    onClick={() => toggleSelectedHashtag(index, tag)}
                                    className={`rounded-full px-2 py-0.5 text-sm ring-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                                      isTagSelected
                                        ? "bg-brand text-white ring-brand/30"
                                        : "bg-white text-zinc-600 ring-zinc-200 hover:ring-zinc-300"
                                    }`}
                                  >
                                    {tag.startsWith("#") ? tag : `#${tag}`}
                                  </button>
                                );
                              })}
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

                <div className="mt-6 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleCaptionCopy("caption")}
                      className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-medium text-white transition hover:bg-zinc-800"
                    >
                      Copy caption
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCaptionCopy("hashtags")}
                      className="rounded-full bg-white px-4 py-2 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 transition hover:ring-zinc-300"
                    >
                      Copy hashtags
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCaptionCopy("all")}
                      className="rounded-full bg-white px-4 py-2 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 transition hover:ring-zinc-300"
                    >
                      Copy all
                    </button>
                    <button
                      type="button"
                      onClick={handleRegenerate}
                      disabled={isSubmitting}
                      className="rounded-full bg-white px-4 py-2 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 transition hover:ring-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Regenerate
                    </button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => handlePlatformHandoff("instagram")}
                      className="rounded-2xl bg-gradient-to-r from-pink-500 via-orange-500 to-yellow-500 px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:opacity-95"
                    >
                      Post on Instagram
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePlatformHandoff("facebook")}
                      className="rounded-2xl bg-[#1877F2] px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:opacity-95"
                    >
                      Post on Facebook
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadCurrentImage}
                      className="rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:bg-zinc-800"
                    >
                      Download image
                    </button>
                  </div>
                </div>

                {actionMessage ? (
                  <p className="mt-4 text-sm text-zinc-500">{actionMessage}</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
