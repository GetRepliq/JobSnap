import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { createAdminSupabaseClient } from "../../../lib/supabase/admin";
import { checkUserRateLimit } from "../../../lib/supabase/user-route";
import {
  extractContextFromImage,
  generatePostPackage,
} from "../../../lib/ai/gemini";

const JOB_IMAGES_BUCKET =
  process.env.SUPABASE_JOB_IMAGES_BUCKET ??
  process.env.NEXT_PUBLIC_SUPABASE_JOB_IMAGES_BUCKET ??
  "job-images";

function getFileExtension(imageFile) {
  const filename = imageFile?.name ?? "";
  const nameExtension = filename.includes(".")
    ? filename.split(".").pop()?.toLowerCase()
    : "";
  const mimeExtension = imageFile?.type?.split("/").pop()?.toLowerCase();
  const normalized = (nameExtension || mimeExtension || "jpg").replace(/[^a-z0-9]/g, "");

  return normalized || "jpg";
}

function buildStoragePath({ businessId, jobPostId, imageFile }) {
  return `${businessId}/${jobPostId}/${randomUUID()}.${getFileExtension(imageFile)}`;
}

function formatHashtags(hashtags = []) {
  return hashtags
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    .join(" ")
    .trim();
}

function createRouteError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

const DEFAULT_FREE_POSTS = 20;

async function reserveUsage(adminSupabase, businessId) {
  const { data: usageRow, error: usageReadError } = await adminSupabase
    .from("usage")
    .select("posts_used, free_posts_remaining")
    .eq("business_id", businessId)
    .maybeSingle();

  if (usageReadError) {
    throw createRouteError(usageReadError.message);
  }

  const freeRemaining = usageRow?.free_posts_remaining ?? DEFAULT_FREE_POSTS;

  if (freeRemaining <= 0) {
    throw createRouteError("You've used all your free posts.", 402);
  }

  const postsUsed = (usageRow?.posts_used ?? 0) + 1;
  const freePostsRemaining = Math.max(freeRemaining - 1, 0);

  const { error: usageUpsertError } = await adminSupabase.from("usage").upsert(
    {
      business_id: businessId,
      posts_used: postsUsed,
      free_posts_remaining: freePostsRemaining,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id" }
  );

  if (usageUpsertError) {
    throw createRouteError(usageUpsertError.message);
  }

  return {
    business_id: businessId,
    posts_used: postsUsed,
    free_posts_remaining: freePostsRemaining,
  };
}

async function refundUsage(adminSupabase, businessId) {
  const { data: usageRow, error: usageReadError } = await adminSupabase
    .from("usage")
    .select("posts_used, free_posts_remaining")
    .eq("business_id", businessId)
    .maybeSingle();

  if (usageReadError) {
    return null;
  }

  const postsUsed = Math.max((usageRow?.posts_used ?? 1) - 1, 0);
  const freePostsRemaining = Math.min(
    (usageRow?.free_posts_remaining ?? 0) + 1,
    DEFAULT_FREE_POSTS
  );

  const { error: usageUpsertError } = await adminSupabase.from("usage").upsert(
    {
      business_id: businessId,
      posts_used: postsUsed,
      free_posts_remaining: freePostsRemaining,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id" }
  );

  if (usageUpsertError) {
    return null;
  }

  return {
    business_id: businessId,
    posts_used: postsUsed,
    free_posts_remaining: freePostsRemaining,
  };
}

function getPublicErrorMessage(error) {
  const status = error?.status ?? 500;

  if (status === 401 || status === 402 || status === 429) {
    return error instanceof Error ? error.message : "Request could not be completed.";
  }

  if (status >= 400 && status < 500 && error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong on our end. Please try uploading the image again!";
}

function formatStorageUploadError(uploadError) {
  const message = uploadError?.message || "Failed to upload image.";

  if (/bucket not found/i.test(message)) {
    return createRouteError(
      `Supabase storage bucket "${JOB_IMAGES_BUCKET}" was not found. Create that bucket in Supabase or set SUPABASE_JOB_IMAGES_BUCKET to an existing bucket name.`
    );
  }

  return createRouteError(message);
}

async function bestEffortCleanup({
  supabase,
  storagePathOriginal,
  jobImageId,
  generatedPostId,
  messageIds = [],
  conversationId,
  jobPostId,
}) {
  async function tryCleanup(operation) {
    try {
      await operation;
    } catch {
      // Best-effort rollback only.
    }
  }

  if (generatedPostId) {
    await tryCleanup(
      supabase.from("generated_posts").delete().eq("id", generatedPostId)
    );
  }

  if (messageIds.length > 0) {
    await tryCleanup(supabase.from("messages").delete().in("id", messageIds));
  }

  if (conversationId) {
    await tryCleanup(
      supabase.from("conversations").delete().eq("id", conversationId)
    );
  }

  if (jobImageId) {
    await tryCleanup(supabase.from("job_images").delete().eq("id", jobImageId));
  }

  if (jobPostId) {
    await tryCleanup(supabase.from("job_posts").delete().eq("id", jobPostId));
  }

  if (storagePathOriginal) {
    await tryCleanup(
      supabase.storage.from(JOB_IMAGES_BUCKET).remove([storagePathOriginal])
    );
  }
}

export async function POST(request) {
  let storagePathOriginal = null;
  let jobImageId = null;
  let generatedPostId = null;
  let conversationId = null;
  let jobPostId = null;
  let jobImageUrl = null;
  let messageIds = [];
  let supabase;
  let adminSupabase;
  let usageReserved = false;
  let reservedBusinessId = null;
  let reservedUsage = null;

  try {
    const formData = await request.formData();
    const prompt = String(formData.get("prompt") ?? "").trim();
    const image = formData.get("image");

    const imageFile =
      image instanceof File && image.size > 0 ? image : null;

    supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const aiRateLimit = checkUserRateLimit(user.id, "AI_GENERATION");

    if (!aiRateLimit.allowed) {
      return NextResponse.json(
        { error: "AI generation rate limit exceeded. Try again in a moment." },
        {
          status: 429,
          headers: { "Retry-After": String(aiRateLimit.retryAfterSeconds) },
        }
      );
    }

    const [{ data: profileRows, error: profileError }, { data: businessRows, error: businessError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", user.id)
          .limit(1),
        supabase
          .from("businesses")
          .select("id, business_name, trade, location, tone, website, instagram_handle")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    if (businessError) {
      return NextResponse.json({ error: businessError.message }, { status: 400 });
    }

    const profile = profileRows?.[0];
    const business = businessRows?.[0];

    if (!profile || !business) {
      return NextResponse.json(
        { error: "Complete onboarding before using the composer." },
        { status: 400 }
      );
    }

    if (imageFile) {
      const uploadRateLimit = checkUserRateLimit(user.id, "STORAGE_UPLOAD");

      if (!uploadRateLimit.allowed) {
        return NextResponse.json(
          { error: "Upload rate limit exceeded. Try again in a moment." },
          {
            status: 429,
            headers: { "Retry-After": String(uploadRateLimit.retryAfterSeconds) },
          }
        );
      }
    }

    adminSupabase = createAdminSupabaseClient();

    const { data: jobPost, error: jobPostError } = await adminSupabase
      .from("job_posts")
      .insert({
        business_id: business.id,
        created_by: user.id,
        title: prompt || `Post draft for ${business.business_name}`,
        description: prompt || null,
        job_location: business.location || null,
        status: "draft",
      })
      .select("id")
      .single();

    if (jobPostError) {
      throw createRouteError(jobPostError.message);
    }

    jobPostId = jobPost.id;

    if (imageFile) {
      const imageBytes = Buffer.from(await imageFile.arrayBuffer());
      storagePathOriginal = buildStoragePath({
        businessId: business.id,
        jobPostId,
        imageFile,
      });

      const { error: uploadError } = await adminSupabase.storage
        .from(JOB_IMAGES_BUCKET)
        .upload(storagePathOriginal, imageBytes, {
          contentType: imageFile.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        throw formatStorageUploadError(uploadError);
      }

      const { data: jobImage, error: jobImageError } = await adminSupabase
        .from("job_images")
        .insert({
          job_post_id: jobPostId,
          storage_path_original: storagePathOriginal,
          storage_path_compressed: null,
          mime_type: imageFile.type || null,
        })
        .select("id")
        .single();

      if (jobImageError) {
        throw createRouteError(jobImageError.message);
      }

      jobImageId = jobImage.id;

      const { data: signedImage, error: signedImageError } =
        await adminSupabase.storage
          .from(JOB_IMAGES_BUCKET)
          .createSignedUrl(storagePathOriginal, 60 * 60 * 24 * 7);

      if (signedImageError) {
        throw createRouteError(signedImageError.message);
      }

      jobImageUrl = signedImage?.signedUrl ?? null;
    }

    reservedUsage = await reserveUsage(adminSupabase, business.id);
    usageReserved = true;
    reservedBusinessId = business.id;

    const extraction = await extractContextFromImage({
      imageFile,
      business,
      prompt,
    });

    const generation = await generatePostPackage({
      imageFile,
      business,
      prompt,
      extraction,
    });

    const bestCaptionIndex = Number.isInteger(generation?.best_caption_index)
      ? generation.best_caption_index
      : 0;
    const bestCaption =
      generation?.captions?.[bestCaptionIndex] ?? generation?.captions?.[0];
    const hashtagsText = formatHashtags(bestCaption?.hashtags ?? []);

    const conversationTitle =
      bestCaption?.caption?.slice(0, 80) ||
      prompt.slice(0, 80) ||
      `Post draft for ${business.business_name}`;

    const { data: conversation, error: conversationError } = await adminSupabase
      .from("conversations")
      .insert({
        business_id: business.id,
        created_by: user.id,
        title: conversationTitle,
      })
      .select("id")
      .single();

    if (conversationError) {
      throw createRouteError(conversationError.message);
    }

    conversationId = conversation.id;

    const assistantContent = {
      extraction,
      generation,
      jobPostId,
      jobImageId,
      jobImageUrl,
      jobImageStoragePath: storagePathOriginal,
    };

    const { data: insertedMessages, error: messageError } = await adminSupabase
      .from("messages")
      .insert([
        {
          conversation_id: conversationId,
          role: "user",
          content: prompt || "Image analysis request",
        },
        {
          conversation_id: conversationId,
          role: "assistant",
          content: JSON.stringify(assistantContent),
        },
      ])
      .select("id");

    if (messageError) {
      throw createRouteError(messageError.message);
    }

    messageIds = insertedMessages?.map((message) => message.id) ?? [];

    const { data: generatedPost, error: generatedPostError } = await adminSupabase
      .from("generated_posts")
      .insert({
        job_post_id: jobPostId,
        platform: "instagram",
        caption: bestCaption?.caption || prompt || "Generated post",
        hashtags: hashtagsText || null,
        prompt_snapshot: prompt || null,
        model_name: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      })
      .select("id")
      .single();

    if (generatedPostError) {
      throw createRouteError(generatedPostError.message);
    }

    generatedPostId = generatedPost.id;

    const { error: jobPostUpdateError } = await adminSupabase
      .from("job_posts")
      .update({
        title: conversationTitle,
        description:
          prompt || extraction?.scene_summary || bestCaption?.caption || null,
        status: "generated",
      })
      .eq("id", jobPostId);

    if (jobPostUpdateError) {
      throw createRouteError(jobPostUpdateError.message);
    }

    return NextResponse.json({
      conversationId,
      profile: profileRows?.[0],
      business,
      jobPost: {
        id: jobPostId,
        title: conversationTitle,
        description: prompt || extraction?.scene_summary || bestCaption?.caption || null,
        status: "generated",
      },
      generatedPost: {
        id: generatedPostId,
        job_post_id: jobPostId,
        caption: bestCaption?.caption || prompt || "Generated post",
        hashtags: hashtagsText,
      },
      jobImage:
        jobImageId && storagePathOriginal
          ? {
              id: jobImageId,
              job_post_id: jobPostId,
              storage_path_original: storagePathOriginal,
              imageUrl: jobImageUrl,
            }
          : null,
      usage: reservedUsage,
      extraction,
      generation,
    });
  } catch (error) {
    if (adminSupabase || supabase) {
      await bestEffortCleanup({
        supabase: adminSupabase ?? supabase,
        storagePathOriginal,
        jobImageId,
        generatedPostId,
        messageIds,
        conversationId,
        jobPostId,
      });
    }

    let refundedUsage = null;

    if (usageReserved && reservedBusinessId && adminSupabase) {
      refundedUsage = await refundUsage(adminSupabase, reservedBusinessId);
    }

    return NextResponse.json(
      {
        error: getPublicErrorMessage(error),
        usage: refundedUsage,
      },
      { status: error?.status ?? 500 }
    );
  }
}
