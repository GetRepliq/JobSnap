"use client";

export default function InstagramPostPreview({
  instagramHandle,
  imageUrl,
  captionText = "",
  hashtagText = "",
}) {
  const displayHandle = instagramHandle?.replace(/^@/, "") || "your_business";
  const previewCaption =
    captionText.length > 80 ? `${captionText.slice(0, 80)}… ` : captionText;

  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
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

      {imageUrl ? (
        <div className="aspect-square w-full bg-zinc-100">
          <img
            src={imageUrl}
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

        <p className="mt-2 text-xs font-semibold text-zinc-900">45.9K likes</p>

        <p className="mt-1 text-sm leading-5 text-zinc-800">
          <span className="font-semibold">{displayHandle}</span>{" "}
          {previewCaption}
          {captionText.length > 80 ? (
            <span className="text-zinc-400">more</span>
          ) : null}
        </p>

        {hashtagText ? (
          <p className="mt-1 text-sm text-brand">{hashtagText}</p>
        ) : null}

        <p className="mt-1 text-[11px] uppercase text-zinc-400">20 hours ago</p>
      </div>
    </div>
  );
}
