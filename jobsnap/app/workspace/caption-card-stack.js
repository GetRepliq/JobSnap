"use client";

import { useRef } from "react";
import {
  buildCaptionText,
  copyTextToClipboard,
  formatHashtag,
} from "../../lib/post-actions";

function getCardStyle(offset) {
  if (offset === 0) {
    return {
      zIndex: 30,
      transform: "translateX(0) scale(1) rotate(0deg)",
      opacity: 1,
      pointerEvents: "auto",
    };
  }

  if (offset === -1) {
    return {
      zIndex: 20,
      transform: "translateX(-28px) scale(0.94) rotate(-3deg)",
      opacity: 0.85,
      pointerEvents: "none",
    };
  }

  if (offset === 1) {
    return {
      zIndex: 20,
      transform: "translateX(28px) scale(0.94) rotate(3deg)",
      opacity: 0.85,
      pointerEvents: "none",
    };
  }

  return {
    zIndex: 10,
    transform: `translateX(${offset < 0 ? -48 : 48}px) scale(0.88) rotate(${offset < 0 ? -5 : 5}deg)`,
    opacity: 0,
    pointerEvents: "none",
  };
}

function Button3D({ variant, children, onClick, className = "" }) {
  const variants = {
    copy: "bg-emerald-100 text-emerald-800 shadow-[0_4px_0_#15803d] hover:bg-emerald-200 active:translate-y-1 active:shadow-[0_2px_0_#15803d]",
    instagram:
      "bg-gradient-to-r from-pink-500 via-orange-500 to-yellow-500 text-white shadow-[0_4px_0_#9333ea] hover:opacity-95 active:translate-y-1 active:shadow-[0_2px_0_#9333ea]",
    facebook:
      "bg-sky-100 text-sky-800 shadow-[0_4px_0_#1d4ed8] hover:bg-sky-200 active:translate-y-1 active:shadow-[0_2px_0_#1d4ed8]",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-150 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export default function CaptionCardStack({
  captions = [],
  bestCaptionIndex = 0,
  activeIndex = 0,
  onActiveIndexChange,
  captionDrafts = {},
  onCaptionDraftChange,
  selectedHashtagSelections = {},
  onToggleHashtag,
  onPostInstagram,
  onPostFacebook,
  copiedCaptionIndex = null,
  onCopiedCaptionIndexChange,
  onCopySuccess,
}) {
  const copiedTimeoutRef = useRef(null);

  function goToPrevious() {
    if (activeIndex > 0) {
      onActiveIndexChange?.(activeIndex - 1);
    }
  }

  function goToNext() {
    if (activeIndex < captions.length - 1) {
      onActiveIndexChange?.(activeIndex + 1);
    }
  }

  async function handleCopy(index, item) {
    const captionText = captionDrafts[index] ?? item.caption ?? "";
    const hashtags = selectedHashtagSelections[index] ?? item.hashtags ?? [];
    const payload = buildCaptionText(captionText, hashtags);

    if (!payload) {
      return;
    }

    await copyTextToClipboard(payload);
    onCopiedCaptionIndexChange?.(index);
    onCopySuccess?.(`Caption ${index + 1} copied.`);

    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
    }

    copiedTimeoutRef.current = setTimeout(() => {
      onCopiedCaptionIndexChange?.(null);
    }, 1400);
  }

  if (captions.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Generation completed but no captions were returned.
      </p>
    );
  }

  const orderedIndices = captions
    .map((_, index) => index)
    .sort((a, b) => Math.abs(b - activeIndex) - Math.abs(a - activeIndex));

  return (
    <div className="flex flex-col">
      <div className="relative mx-auto min-h-[520px] w-full max-w-md">
        {orderedIndices.map((index) => {
          const item = captions[index];
          const offset = index - activeIndex;
          const style = getCardStyle(offset);
          const isActive = offset === 0;
          const isBest = index === bestCaptionIndex;
          const captionHashtags = item.hashtags ?? [];
          const selectedTags =
            selectedHashtagSelections[index] ?? captionHashtags;
          const captionText = captionDrafts[index] ?? item.caption ?? "";

          return (
            <article
              key={`${index}-${item.caption?.slice(0, 12) ?? index}`}
              aria-hidden={!isActive}
              className="absolute inset-x-0 top-0 origin-center transition-all duration-500 ease-out"
              style={{
                zIndex: style.zIndex,
                transform: style.transform,
                opacity: style.opacity,
                pointerEvents: style.pointerEvents,
              }}
            >
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.12)]">
                {isBest ? (
                  <div className="bg-brand px-4 py-2 text-center text-sm font-semibold text-white">
                    Top Pick
                  </div>
                ) : null}

                <div className="p-5">
                  <p className="text-base font-bold text-zinc-900">
                    Caption {index + 1}
                  </p>

                  {item.angle ? (
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      {item.angle}
                    </p>
                  ) : null}

                  {isActive ? (
                    <textarea
                      rows={6}
                      value={captionText}
                      onChange={(event) =>
                        onCaptionDraftChange?.(index, event.target.value)
                      }
                      className="mt-4 w-full resize-none border-none bg-transparent p-0 text-sm leading-6 text-zinc-800 focus:outline-none focus:ring-0"
                      aria-label={`Edit caption ${index + 1}`}
                    />
                  ) : (
                    <p className="mt-4 line-clamp-6 text-sm leading-6 text-zinc-800">
                      {captionText}
                    </p>
                  )}

                  {captionHashtags.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {captionHashtags.map((tag) => {
                        const isTagSelected = selectedTags.some(
                          (selectedTag) =>
                            formatHashtag(selectedTag) === formatHashtag(tag)
                        );

                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => onToggleHashtag?.(index, tag)}
                            disabled={!isActive}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-200 ${
                              isTagSelected
                                ? "bg-brand text-white"
                                : "bg-sky-100 text-sky-700 hover:bg-sky-200"
                            } disabled:cursor-default`}
                          >
                            {formatHashtag(tag)}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  {isActive ? (
                    <div className="mt-5 space-y-2.5">
                      <Button3D
                        variant="copy"
                        className="w-full"
                        onClick={() => handleCopy(index, item)}
                      >
                        {copiedCaptionIndex === index
                          ? "Copied!"
                          : "Copy caption & hashtags"}
                      </Button3D>
                      <div className="grid grid-cols-2 gap-2.5">
                        <Button3D
                          variant="instagram"
                          onClick={() => onPostInstagram?.()}
                        >
                          Post on Instagram
                        </Button3D>
                        <Button3D
                          variant="facebook"
                          onClick={() => onPostFacebook?.()}
                        >
                          Post on Facebook
                        </Button3D>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {captions.length > 1 ? (
        <div className="mt-2 flex items-center justify-between px-2">
          <button
            type="button"
            onClick={goToPrevious}
            disabled={activeIndex === 0}
            aria-label="Previous caption"
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <p className="text-xs text-zinc-400">
            {activeIndex + 1} of {captions.length}
          </p>

          <button
            type="button"
            onClick={goToNext}
            disabled={activeIndex === captions.length - 1}
            aria-label="Next caption"
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M9 18l6-6-6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  );
}
