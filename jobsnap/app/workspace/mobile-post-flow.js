"use client";

import { useEffect, useRef, useState } from "react";

function formatHashtag(tag) {
  return tag.startsWith("#") ? tag : `#${tag}`;
}

function collectHashtags(captions) {
  const seen = new Set();
  const tags = [];

  for (const item of captions) {
    for (const tag of item.hashtags ?? []) {
      const normalized = formatHashtag(tag);
      if (!seen.has(normalized.toLowerCase())) {
        seen.add(normalized.toLowerCase());
        tags.push(normalized);
      }
    }
  }

  return tags;
}

function formatConversationDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function MobilePostFlow({
  instagramHandle,
  conversations = [],
  onConversationCreated,
  onLoadConversation,
  onReset,
  loadingConversationId,
  initialGeneration = null,
  initialConversationId = null,
  initialPrompt = "",
}) {
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(initialGeneration ? 2 : 1);
  const [description, setDescription] = useState(initialPrompt);
  const [attachedImage, setAttachedImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [generationResult, setGenerationResult] = useState(
    initialGeneration
      ? {
          conversationId: initialConversationId,
          generation: initialGeneration,
        }
      : null
  );
  const [selectedCaptionIndex, setSelectedCaptionIndex] = useState(
    initialGeneration?.best_caption_index ?? 0
  );
  const [showHistory, setShowHistory] = useState(false);

  const captions = generationResult?.generation?.captions ?? [];
  const hashtags = collectHashtags(captions);
  const selectedCaption = captions[selectedCaptionIndex];
  const displayHandle = instagramHandle?.replace(/^@/, "") || "your_business";

  useEffect(() => {
    return () => {
      if (attachedImage?.previewUrl) {
        URL.revokeObjectURL(attachedImage.previewUrl);
      }
    };
  }, [attachedImage]);

  function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (attachedImage?.previewUrl) {
      URL.revokeObjectURL(attachedImage.previewUrl);
    }

    setAttachedImage({
      file,
      previewUrl: URL.createObjectURL(file),
    });
    setError("");
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleStep1Continue() {
    if (!attachedImage?.file) {
      setError("Please upload a picture to continue.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("prompt", description);
      formData.append("image", attachedImage.file);

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
      setSelectedCaptionIndex(payload.generation?.best_caption_index ?? 0);
      onConversationCreated?.(payload);
      setStep(2);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Something went wrong."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleFinish() {
    if (attachedImage?.previewUrl) {
      URL.revokeObjectURL(attachedImage.previewUrl);
    }

    setAttachedImage(null);
    setDescription("");
    setGenerationResult(null);
    setSelectedCaptionIndex(0);
    setError("");
    setStep(1);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    onReset?.();
  }

  async function handleSelectConversation(conversationId) {
    setShowHistory(false);
    setError("");

    try {
      const loaded = await onLoadConversation?.(conversationId);
      if (!loaded?.generation) return;

      setGenerationResult({
        conversationId: loaded.conversationId,
        generation: loaded.generation,
      });
      setSelectedCaptionIndex(loaded.generation.best_caption_index ?? 0);
      setDescription(loaded.prompt ?? "");
      setStep(2);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load conversation."
      );
    }
  }

  const previewImageUrl = attachedImage?.previewUrl;
  const captionPreview = selectedCaption?.caption ?? "";
  const captionHashtags = (selectedCaption?.hashtags ?? [])
    .map(formatHashtag)
    .join(" ");

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white text-zinc-950">
      <header className="flex items-center justify-between px-5 pt-4">
        <button
          type="button"
          onClick={() => setShowHistory(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-100"
          aria-label="Past posts"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 6h16M4 12h16M4 18h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <p className="text-sm font-medium text-zinc-400">JobSnap</p>
        <div className="h-10 w-10" />
      </header>

      <div className="flex flex-1 flex-col px-5 pb-8 pt-6">
        {step === 1 ? (
          <>
            <h1 className="text-center text-2xl font-bold tracking-tight text-zinc-950">
              1. Upload the picture
            </h1>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={handleUploadClick}
              className="mx-auto mt-8 flex aspect-square w-full max-w-[280px] items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 transition hover:border-zinc-300"
            >
              {previewImageUrl ? (
                <img
                  src={previewImageUrl}
                  alt="Uploaded job site"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-5xl font-light text-zinc-300">+</span>
              )}
            </button>

            <div className="mt-8">
              <label
                htmlFor="mobile-description"
                className="text-sm text-zinc-400"
              >
                Add a description (Optional)
              </label>
              <textarea
                id="mobile-description"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder=""
                className="mt-2 w-full resize-none rounded-2xl border border-zinc-200 px-4 py-3 text-base text-zinc-800 placeholder:text-zinc-300 focus:border-zinc-300 focus:outline-none"
              />
            </div>

            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

            <div className="mt-auto pt-10">
              <button
                type="button"
                onClick={handleStep1Continue}
                disabled={isSubmitting}
                className="w-full rounded-full bg-zinc-950 py-4 text-base font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Generating…" : "Continue"}
              </button>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1 className="text-center text-2xl font-bold leading-tight tracking-tight text-zinc-950">
              2. Choose the perfect hashtags &amp; caption
            </h1>

            {hashtags.length > 0 ? (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <p className="mt-8 text-sm text-zinc-400">
              Choose the best suited caption
            </p>

            <div className="mt-3 space-y-3">
              {captions.map((item, index) => {
                const isSelected = index === selectedCaptionIndex;

                return (
                  <button
                    key={`${index}-${item.caption?.slice(0, 16) ?? index}`}
                    type="button"
                    onClick={() => setSelectedCaptionIndex(index)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? "border-zinc-950 bg-zinc-50 ring-1 ring-zinc-950"
                        : "border-zinc-200 bg-white hover:border-zinc-300"
                    }`}
                  >
                    <p className="text-sm leading-6 text-zinc-700">{item.caption}</p>
                  </button>
                );
              })}
            </div>

            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

            <div className="mt-auto pt-10">
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!selectedCaption}
                className="w-full rounded-full bg-zinc-950 py-4 text-base font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h1 className="text-center text-2xl font-bold tracking-tight text-zinc-950">
              3. Upload the post
            </h1>

            <div className="mx-auto mt-6 w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 px-3 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
                    <div className="h-6 w-6 rounded-full bg-zinc-200" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{displayHandle}</p>
                  <p className="text-[11px] text-zinc-400">Suggested for you</p>
                </div>
              </div>

              {previewImageUrl ? (
                <div className="aspect-square w-full bg-zinc-100">
                  <img
                    src={previewImageUrl}
                    alt="Post preview"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-zinc-100 text-sm text-zinc-400">
                  No image preview
                </div>
              )}

              <div className="px-3 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                        fill="#ef4444"
                      />
                    </svg>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M22 3L11 14M22 3l-7 19-4-9-9-4 19-7z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>

                <p className="mt-2 text-xs font-semibold text-zinc-900">
                  45.9K likes
                </p>

                <p className="mt-1 text-sm leading-5 text-zinc-800">
                  <span className="font-semibold">{displayHandle}</span>{" "}
                  {captionPreview.length > 80
                    ? `${captionPreview.slice(0, 80)}… `
                    : captionPreview}
                  {captionPreview.length > 80 ? (
                    <span className="text-zinc-400">more</span>
                  ) : null}
                </p>

                {captionHashtags ? (
                  <p className="mt-1 text-sm text-brand">{captionHashtags}</p>
                ) : null}

                <p className="mt-1 text-[11px] uppercase text-zinc-400">20 hours ago</p>
              </div>
            </div>

            <div className="mt-auto pt-10">
              <button
                type="button"
                onClick={() => {
                  const copyText = [captionPreview, captionHashtags]
                    .filter(Boolean)
                    .join("\n\n");
                  if (copyText) {
                    navigator.clipboard.writeText(copyText);
                  }
                  handleFinish();
                }}
                className="w-full rounded-full bg-emerald-500 py-4 text-base font-medium text-white transition hover:bg-emerald-600"
              >
                Job Finished!
              </button>
            </div>
          </>
        ) : null}
      </div>

      {showHistory ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <p className="text-base font-semibold text-zinc-900">Past posts</p>
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="rounded-full px-3 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
            >
              Close
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {conversations.length === 0 ? (
              <p className="px-2 py-6 text-sm text-zinc-500">
                No posts yet. Upload a picture to create your first one.
              </p>
            ) : (
              <ul className="space-y-1">
                {conversations.map((chat) => {
                  const isLoading = loadingConversationId === chat.id;

                  return (
                    <li key={chat.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectConversation(chat.id)}
                        disabled={isLoading}
                        className="w-full rounded-xl px-3 py-3 text-left transition hover:bg-zinc-50 disabled:opacity-60"
                      >
                        <p className="truncate text-sm font-medium text-zinc-800">
                          {chat.title?.trim() || "Untitled post"}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {isLoading ? "Loading…" : formatConversationDate(chat.created_at)}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-zinc-100 px-5 py-4">
            <button
              type="button"
              onClick={() => {
                setShowHistory(false);
                handleFinish();
              }}
              className="w-full rounded-full bg-zinc-950 py-3 text-sm font-medium text-white"
            >
              + New post
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
