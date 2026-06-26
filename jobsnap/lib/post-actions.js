"use client";

const PLATFORM_URLS = {
  instagram: "https://www.instagram.com/",
  facebook: "https://www.facebook.com/",
};

export function formatHashtag(tag) {
  return tag.startsWith("#") ? tag : `#${tag}`;
}

export function buildCaptionText(caption, hashtags = []) {
  const hashtagText = hashtags.map(formatHashtag).join(" ").trim();
  return [caption?.trim(), hashtagText].filter(Boolean).join("\n\n");
}

export function getPlatformLabel(platform) {
  return platform === "facebook" ? "Facebook" : "Instagram";
}

export function getPlatformUrl(platform) {
  return PLATFORM_URLS[platform] ?? PLATFORM_URLS.instagram;
}

export async function copyTextToClipboard(text) {
  if (!text) return false;

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
  return true;
}

async function fetchImageFile(imageUrl, fallbackName) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error("Could not prepare the image for sharing.");
  }

  const blob = await response.blob();
  const inferredType = blob.type || "image/jpeg";
  return new File([blob], fallbackName, { type: inferredType });
}

export async function resolveShareImage({ imageFile, imageUrl, fallbackName }) {
  if (imageFile instanceof File) {
    return imageFile;
  }

  if (imageUrl) {
    return fetchImageFile(imageUrl, fallbackName);
  }

  return null;
}

export async function downloadImage({ imageFile, imageUrl, fallbackName }) {
  const file = await resolveShareImage({ imageFile, imageUrl, fallbackName });

  if (!file) {
    return false;
  }

  const objectUrl = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = file.name || fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
  return true;
}

export async function sharePostToPlatform({
  platform,
  captionText,
  imageFile,
  imageUrl,
  fallbackName,
  useNativeShare = false,
}) {
  const platformUrl = getPlatformUrl(platform);
  const label = getPlatformLabel(platform);

  if (useNativeShare && navigator.share) {
    const shareImage = await resolveShareImage({
      imageFile,
      imageUrl,
      fallbackName,
    });

    const shareData = {
      title: `${label} post from JobSnap`,
      text: captionText,
    };

    if (shareImage && navigator.canShare?.({ files: [shareImage] })) {
      shareData.files = [shareImage];
    }

    await navigator.share(shareData);
    return { mode: "native-share" };
  }

  await copyTextToClipboard(captionText);

  if (imageFile || imageUrl) {
    await downloadImage({
      imageFile,
      imageUrl,
      fallbackName,
    });
  }

  window.open(platformUrl, "_blank", "noopener,noreferrer");
  return { mode: "handoff" };
}
