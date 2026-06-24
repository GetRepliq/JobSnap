"use client";

import { useState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { getUserDestination } from "../../lib/supabase/user-route";

const initialForm = {
  fullName: "",
  businessName: "",
  trade: "",
  location: "",
  tone: "",
  website: "",
  instagramHandle: "",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [formData, setFormData] = useState(initialForm);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [checkingUser, setCheckingUser] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data, error }) => {
      if (error) {
        setCheckingUser(false);
        return;
      }

      if (!data.user) {
        router.replace("/auth");
        return;
      }

      try {
        const destination = await getUserDestination(supabase, data.user.id);
        if (destination === "/workspace") {
          router.replace(destination);
          return;
        }
      } catch {
        // stay on onboarding if the lookup fails
      }

      setCheckingUser(false);
    });
  }, [router]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const getErrorMessage = (error) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (error && typeof error === "object" && "message" in error) {
      return String(error.message);
    }

    if (typeof error === "string" && error.trim()) {
      return error;
    }

    return "Something went wrong.";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setStatus("error");
        setMessage("Please sign in before saving your info.");
        return;
      }

      const profilePayload = {
        id: user.id,
        full_name: formData.fullName.trim(),
        email: user.email ?? null,
      };

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(profilePayload);

      if (profileError) {
        throw profileError;
      }

      const businessPayload = {
        owner_id: user.id,
        business_name: formData.businessName.trim(),
        trade: formData.trade.trim(),
        location: formData.location.trim(),
        tone: formData.tone.trim(),
        website: formData.website.trim(),
        instagram_handle: formData.instagramHandle.trim(),
      };

      const { data: existingBusiness, error: businessLookupError } =
        await supabase
          .from("businesses")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();

      if (businessLookupError) {
        throw businessLookupError;
      }

      const businessQuery = existingBusiness?.id
        ? supabase
            .from("businesses")
            .update(businessPayload)
            .eq("id", existingBusiness.id)
        : supabase.from("businesses").insert(businessPayload);

      const { error: businessError } = await businessQuery;

      if (businessError) {
        throw businessError;
      }

      setStatus("success");
      setMessage("Saved.");
    } catch (error) {
      setStatus("error");
      setMessage(getErrorMessage(error));
    }
  };

  return (
    <main className="min-h-screen bg-white px-6 py-10 text-zinc-950 sm:px-10">
      {checkingUser ? (
        <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center text-sm text-zinc-600">
          Checking your account...
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          <div>
            <p className="text-sm font-medium text-brand">JobSnap onboarding</p>
            <h1 className="mt-2 font-display text-4xl">Tell us about your business</h1>
            <p className="mt-3 max-w-2xl text-base text-zinc-600">
              We use this to personalize captions, hashtags, and the overall tone
              of your posts.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="grid gap-5 rounded-3xl border border-zinc-200 bg-zinc-50 p-6 shadow-sm sm:p-8"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium">Full name</span>
                <input
                  name="fullName"
                  required
                  value={formData.fullName}
                  onChange={handleChange}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none ring-0 transition focus:border-brand"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium">Business name</span>
                <input
                  name="businessName"
                  required
                  value={formData.businessName}
                  onChange={handleChange}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none ring-0 transition focus:border-brand"
                />
              </label>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium">Trade</span>
                <input
                  name="trade"
                  placeholder="Builder, electrician, landscaper..."
                  value={formData.trade}
                  onChange={handleChange}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none ring-0 transition focus:border-brand"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium">Location</span>
                <input
                  name="location"
                  placeholder="City, region"
                  value={formData.location}
                  onChange={handleChange}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none ring-0 transition focus:border-brand"
                />
              </label>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium">Tone</span>
                <input
                  name="tone"
                  placeholder="Friendly, bold, premium..."
                  value={formData.tone}
                  onChange={handleChange}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none ring-0 transition focus:border-brand"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium">Website</span>
                <input
                  name="website"
                  placeholder="https://..."
                  value={formData.website}
                  onChange={handleChange}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none ring-0 transition focus:border-brand"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-medium">Instagram handle</span>
              <input
                name="instagramHandle"
                placeholder="@yourhandle"
                value={formData.instagramHandle}
                onChange={handleChange}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none ring-0 transition focus:border-brand"
              />
            </label>

            {message ? (
              <p
                className={`text-sm ${
                  status === "error" ? "text-red-600" : "text-emerald-600"
                }`}
              >
                {message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={status === "saving"}
              className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-3 text-sm font-medium text-brand-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "saving" ? "Saving..." : "Okay, done"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
