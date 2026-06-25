import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import {
  extractContextFromImage,
  generatePostPackage,
} from "../../../lib/ai/gemini";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const prompt = String(formData.get("prompt") ?? "").trim();
    const image = formData.get("image");

    const imageFile =
      image instanceof File && image.size > 0 ? image : null;

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const conversationTitle =
      generation?.captions?.[0]?.caption?.slice(0, 80) ||
      prompt.slice(0, 80) ||
      `Post draft for ${business.business_name}`;

    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .insert({
        business_id: business.id,
        created_by: user.id,
        title: conversationTitle,
      })
      .select("id")
      .single();

    if (conversationError) {
      return NextResponse.json({ error: conversationError.message }, { status: 400 });
    }

    const assistantContent = {
      extraction,
      generation,
    };

    const { error: messageError } = await supabase.from("messages").insert([
      {
        conversation_id: conversation.id,
        role: "user",
        content: prompt || "Image analysis request",
      },
      {
        conversation_id: conversation.id,
        role: "assistant",
        content: JSON.stringify(assistantContent),
      },
    ]);

    if (messageError) {
      return NextResponse.json({ error: messageError.message }, { status: 400 });
    }

    return NextResponse.json({
      conversationId: conversation.id,
      profile: profileRows?.[0],
      business,
      extraction,
      generation,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Something went wrong." },
      { status: 500 }
    );
  }
}
