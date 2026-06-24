"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { getUserDestination } from "../../lib/supabase/user-route";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const destination = await getUserDestination(supabase, data.user.id);
        router.replace(destination);
      }
    });
  }, [router]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    try {
      const supabase = createClient();
      const result =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });

      if (result.error) {
        throw result.error;
      }

      if (result.data.session) {
        const destination = await getUserDestination(supabase, result.data.user.id);
        router.push(destination);
        return;
      }

      setStatus("idle");
      setMessage(
        mode === "signup"
          ? "Account created. Check your email if confirmation is enabled, then sign in."
          : "Signed in."
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  };

  const handleGoogleAuth = async () => {
    setStatus("saving");
    setMessage("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/onboarding`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  };

  const isBusy = status === "saving";

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-10 text-zinc-950">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-zinc-50 p-8 shadow-sm">
        <p className="text-sm font-medium text-brand">JobSnap access</p>
        <h1 className="mt-2 font-display text-4xl">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-3 text-sm text-zinc-600">
          {mode === "signin"
            ? "Sign in to continue to onboarding."
            : "Create your account, then continue to onboarding."}
        </p>

        <div className="mt-6 flex rounded-full bg-white p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 rounded-full px-4 py-2 ${
              mode === "signin" ? "bg-brand text-white" : "text-zinc-700"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-full px-4 py-2 ${
              mode === "signup" ? "bg-brand text-white" : "text-zinc-700"
            }`}
          >
            Sign up
          </button>
        </div>

        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={isBusy}
          className="mt-4 w-full rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Continue with Google
        </button>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium">Email</span>
            <input
              type="email"
              name="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-brand"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium">Password</span>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-brand"
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
            disabled={isBusy}
            className="rounded-full bg-brand px-6 py-3 text-sm font-medium text-brand-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy
              ? "Working..."
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
      </div>
    </main>
  );
}
