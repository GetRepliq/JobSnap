"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

const initialForm = {
  businessName: "",
  trade: "",
  location: "",
  tone: "",
  website: "",
  instagramHandle: "",
};

export default function NewBusinessPage() {
  const [formData, setFormData] = useState(initialForm);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

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
        setMessage("Please sign in before creating a business.");
        return;
      }

      const { error: businessError } = await supabase.from("businesses").insert({
        owner_id: user.id,
        business_name: formData.businessName.trim(),
        trade: formData.trade.trim(),
        location: formData.location.trim(),
        tone: formData.tone.trim(),
        website: formData.website.trim(),
        instagram_handle: formData.instagramHandle.trim(),
      });

      if (businessError) {
        throw businessError;
      }

      setStatus("success");
      setMessage("Business saved.");
      setFormData(initialForm);
    } catch (error) {
      setStatus("error");
      setMessage(getErrorMessage(error));
    }
  };

  return (
    <main className="min-h-screen bg-white px-6 py-10 text-zinc-950 sm:px-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-brand">JobSnap business</p>
            <h1 className="mt-2 font-display text-4xl">Add a new business</h1>
            <p className="mt-3 max-w-2xl text-base text-zinc-600">
              Keep it simple. Add the business details we need for better captions.
            </p>
          </div>

          <Link
            href="/onboarding"
            className="mt-2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
          >
            Back
          </Link>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-5 rounded-3xl border border-zinc-200 bg-zinc-50 p-6 shadow-sm sm:p-8"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium">Business name</span>
              <input
                name="businessName"
                required
                value={formData.businessName}
                onChange={handleChange}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-brand"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium">Trade</span>
              <input
                name="trade"
                value={formData.trade}
                onChange={handleChange}
                placeholder="Builder, electrician, landscaper..."
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-brand"
              />
            </label>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium">Location</span>
              <input
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="City, region"
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-brand"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium">Tone</span>
              <input
                name="tone"
                value={formData.tone}
                onChange={handleChange}
                placeholder="Friendly, bold, premium..."
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-brand"
              />
            </label>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium">Website</span>
              <input
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://..."
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-brand"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium">Instagram handle</span>
              <input
                name="instagramHandle"
                value={formData.instagramHandle}
                onChange={handleChange}
                placeholder="@yourhandle"
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-brand"
              />
            </label>
          </div>

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
            {status === "saving" ? "Saving..." : "Save business"}
          </button>
        </form>
      </div>
    </main>
  );
}
