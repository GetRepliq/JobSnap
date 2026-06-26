"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildCaptionText,
  copyTextToClipboard,
  downloadImage,
  formatHashtag,
  getPlatformLabel,
  resolveShareImage,
  sharePostToPlatform,
} from "../../lib/post-actions";

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
  onGenerationUpdate,
  loadingConversationId,
  initialGeneration = null,
  initialConversationId = null,
  initialPrompt = "",
  selectedCaptionIndex: initialSelectedCaptionIndex = 0,
  captionDrafts: initialCaptionDrafts = {},
}) {
  const fileInputRef = useRef(null);
  const copiedCaptionTimeoutRef = useRef(null);

  const [step, setStep] = useState(initialGeneration ? 2 : 1);
  const [description, setDescription] = useState(initialPrompt);
  const [attachedImage, setAttachedImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [selectedHashtagSelections, setSelectedHashtagSelections] = useState({});
  const [copiedCaptionIndex, setCopiedCaptionIndex] = useState(null);
  const [generationResult, setGenerationResult] = useState(
    initialGeneration
      ? {
          conversationId: initialConversationId,
          generation: initialGeneration,
        }
      : null
  );
  const [selectedCaptionIndex, setSelectedCaptionIndex] = useState(
    initialSelectedCaptionIndex ?? (initialGeneration?.best_caption_index ?? 0)
  );
  const [captionDrafts, setCaptionDrafts] = useState(
    Object.keys(initialCaptionDrafts).length > 0
      ? initialCaptionDrafts
      : initialGeneration?.captions
        ? Object.fromEntries(
            initialGeneration.captions.map((item, index) => [index, item.caption ?? ""])
          )
        : {}
  );
  const [showHistory, setShowHistory] = useState(false);

  const captions = generationResult?.generation?.captions ?? [];
  const hashtags = collectHashtags(captions);
  const selectedCaption =
    captions[selectedCaptionIndex] ?? captions[generationResult?.generation?.best_caption_index ?? 0] ?? captions[0];
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
  const displayHandle = instagramHandle?.replace(/^@/, "") || "your_business";

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

  function applyGenerationPayload(payload) {
    setGenerationResult(payload);
    syncCaptionDrafts(payload.generation);
    setActionMessage("");
    onGenerationUpdate?.(payload);
  }

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
    if (!attachedImage?.file && !generationResult?.jobImage?.imageUrl) {
      setError("Please upload a picture to continue.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
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
      formData.append("prompt", description);

      if (imageFile) {
        formData.append("image", imageFile);
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

      applyGenerationPayload(payload);
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
    setCaptionDrafts({});
    setSelectedHashtagSelections({});
    setCopiedCaptionIndex(null);
    setError("");
    setActionMessage("");
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

      applyGenerationPayload({
        conversationId: loaded.conversationId,
        generation: loaded.generation,
        extraction: loaded.extraction ?? null,
        jobImage: loaded.jobImage ?? null,
      });
      setDescription(loaded.prompt ?? "");
      setStep(2);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load conversation."
      );
    }
  }

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

  async function handleCardCopy(index, item) {
    const payload = buildCaptionText(
      captionDrafts[index] ?? item.caption ?? "",
      selectedHashtagSelections[index] ?? item.hashtags ?? []
    );

    if (!payload) {
      return;
    }

    await copyTextToClipboard(payload);
    setCopiedCaptionIndex(index);
    setActionMessage(`Caption ${index + 1} copied.`);

    if (copiedCaptionTimeoutRef.current) {
      clearTimeout(copiedCaptionTimeoutRef.current);
    }

    copiedCaptionTimeoutRef.current = setTimeout(() => {
      setCopiedCaptionIndex((current) => (current === index ? null : current));
    }, 1400);
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
        useNativeShare: typeof navigator.share === "function",
      });
      setActionMessage(`${getPlatformLabel(platform)} handoff prepared.`);
    } catch (shareError) {
      setActionMessage(
        shareError instanceof Error
          ? shareError.message
          : `Could not prepare ${getPlatformLabel(platform)}.`
      );
    }
  }

  async function handleRegenerate() {
    await handleStep1Continue();
  }

  const previewImageUrl = attachedImage?.previewUrl ?? generationResult?.jobImage?.imageUrl;
  const captionPreview = selectedCaptionText ?? "";
  const captionHashtags = selectedHashtagText;

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
                const selectedTagsForCard =
                  selectedHashtagSelections[index] ?? item.hashtags ?? [];
                const isBest = index === (generationResult?.generation?.best_caption_index ?? 0);

                return (
                  <div
                    key={`${index}-${item.caption?.slice(0, 16) ?? index}`}
                    className={`rounded-2xl border p-4 transition ${
                      isSelected
                        ? "border-zinc-950 bg-zinc-50 ring-1 ring-zinc-950"
                        : "border-zinc-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedCaptionIndex(index)}
                        className="flex-1 text-left transition-all duration-200 hover:-translate-y-0.5"
                      >
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                            Caption {index + 1}
                          </p>
                          {isBest ? (
                            <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-medium text-white">
                              Top pick
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-zinc-700">{item.caption}</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCardCopy(index, item)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                          copiedCaptionIndex === index
                            ? "border border-emerald-500 bg-emerald-500 text-white"
                            : "border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
                        }`}
                      >
                        {copiedCaptionIndex === index ? "Copied" : "Copy"}
                      </button>
                    </div>

                    {item.hashtags?.length ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {item.hashtags.map((tag) => {
                          const isTagSelected = selectedTagsForCard.some(
                            (selectedTag) =>
                              formatHashtag(selectedTag) === formatHashtag(tag)
                          );

                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => toggleSelectedHashtag(index, tag)}
                              className={`rounded-full px-3 py-1 text-xs ring-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
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

            {selectedCaption ? (
              <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-zinc-900">
                    Edit selected caption
                  </p>
                  <p className="text-xs text-zinc-500">
                    Caption {selectedCaptionIndex + 1}
                  </p>
                </div>
                <textarea
                  rows={4}
                  value={selectedCaptionText}
                  onChange={(event) =>
                    setCaptionDrafts((previous) => ({
                      ...previous,
                      [selectedCaptionIndex]: event.target.value,
                    }))
                  }
                  className="mt-3 w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 text-zinc-800 focus:border-zinc-300 focus:outline-none"
                />
              </div>
            ) : null}

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
                  className="rounded-full bg-white px-4 py-2 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-zinc-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Regenerate
                </button>
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {actionMessage ? (
                <p className="text-sm text-zinc-500">{actionMessage}</p>
              ) : null}
            </div>

            <div className="mt-auto pt-10">
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!selectedCaption}
                className="w-full rounded-full bg-zinc-950 py-4 text-base font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
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

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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

              {actionMessage ? (
                <p className="text-sm text-zinc-500">{actionMessage}</p>
              ) : null}

              <button
                type="button"
                onClick={() => {
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
