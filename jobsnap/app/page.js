import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans">
      {/* Navbar */}
      <header className="flex w-full items-center justify-between px-10 py-6">
        <div className="flex items-center gap-2">
          {/* logo placeholder - swap for real mark */}
          <div className="h-7 w-7 rounded-md bg-zinc-200" />
          <span className="font-display text-lg text-zinc-900">JobSnap</span>
        </div>

        <nav className="hidden items-center gap-8 text-sm text-zinc-700 md:flex">
          <a href="#" className="hover:text-zinc-950">Home</a>
          <a href="#" className="hover:text-zinc-950">Services</a>
          <a href="#" className="hover:text-zinc-950">Plans</a>
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="#"
            className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Let&apos;s Talk
          </a>
          <Link
            href="/auth"
            className="rounded-full bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="relative flex flex-1 flex-col items-center px-6 pt-10 text-center">
        {/* faint grid backdrop */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[760px] opacity-35"
          style={{
            backgroundImage:
              "linear-gradient(to right, #d4d4d8 1px, transparent 1px), linear-gradient(to bottom, #d4d4d8 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage: "radial-gradient(ellipse 65% 80% at 50% 35%, black, transparent)",
          }}
        />

        {/* Update badge */}
        <div className="relative z-10 flex items-center gap-2 rounded-full border border-brand/30 bg-white p-1 pr-4 text-sm">
          <span className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground">
            Update v1.14 🚀
          </span>
          <span className="text-zinc-700">Added new post hashtag filter</span>
        </div>

        {/* Headline */}
        <h1 className="relative z-10 mt-8 max-w-3xl text-4xl font-semibold leading-tight text-zinc-950 sm:text-5xl">
          From job site to social feed
          <br />
          in 60 seconds
        </h1>

        {/* Subtext */}
        <p className="relative z-10 mt-6 max-w-xl text-base leading-7 text-zinc-600">
          Stop wasting time stressing over captions and hashtags after a long
          shift. Just upload a photo of your finished work, and our AI
          instantly creates platform-ready social media posts tailored to
          your business
        </p>

        {/* CTAs */}
        <div className="relative z-10 mt-8 flex items-center gap-3">
          <Link
            href="/auth"
            className="rounded-full bg-brand px-6 py-3 text-sm font-medium text-brand-foreground hover:opacity-90"
          >
            Get Started
          </Link>
          <a
            href="#"
            className="rounded-full bg-zinc-100 px-6 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
          >
            How it works
          </a>
        </div>

        {/* Before / After labels */}
        <div className="relative z-10 mt-20 flex w-full max-w-xl items-center justify-between px-4">
          <span className="font-handwritten text-2xl text-zinc-900">
            Before
          </span>

          <svg
            width="120"
            height="20"
            viewBox="0 0 120 20"
            fill="none"
            className="text-zinc-900"
          >
            <line x1="0" y1="10" x2="105" y2="10" stroke="currentColor" strokeWidth="2" />
            <path d="M98 2L110 10L98 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          <span className="font-handwritten text-2xl text-zinc-900">
            After
          </span>
        </div>

        {/* Before / After visuals */}
        <div className="relative z-10 mt-10 flex w-full max-w-3xl items-start justify-between pb-24">
          <Image
            src="/Job_sites_before.png"
            alt="Job site photos before posting"
            width={480}
            height={520}
            className="h-auto w-[300px] sm:w-[400px]"
            priority
          />

          <Image
            src="/JobSnap-mobile.png"
            alt="JobSnap generated social post on phone"
            width={320}
            height={700}
            className="h-auto w-[200px] sm:w-[260px]"
            priority
          />
        </div>
      </main>

      {/* How it works */}
      <section className="w-full px-6 py-20 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-semibold text-zinc-950 sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600">
            Take a photo of your finished work right at the job site and type
            a few quick words. Our AI instantly turns your photo into a
            ready-to-share social media post with the right captions and
            hashtags. You can market your business and show off your work
            before you even pack up your tools
          </p>

          <div className="mt-14 grid grid-cols-1 gap-12 md:grid-cols-2">
            {/* video placeholder - swap for real walkthrough video */}
            <div className="aspect-[5/5.2] w-full rounded-2xl bg-zinc-100" />

            <div className="flex flex-col gap-10">
              <div>
                <h3 className="text-xl font-semibold text-zinc-950">
                  1. Snap Your Work and Add Context
                </h3>
                <p className="mt-2 leading-7 text-zinc-600">
                  Take a quick photo of your completed job right from your
                  phone. Type a few basic words or speak into your phone to
                  tell the app what you worked on.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-zinc-950">
                  2. Generate Your Social Media Post
                </h3>
                <p className="mt-2 leading-7 text-zinc-600">
                  Our AI reads your photo and details to create a great post
                  instantly. It writes a perfect caption and picks the best
                  hashtags to help local customers find your business.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-zinc-950">
                  3. Review, Edit, and Share
                </h3>
                <p className="mt-2 leading-7 text-zinc-600">
                  Look over the generated post and make any quick changes you
                  want. Tap share to send it directly to your Facebook,
                  Instagram, or Google page before you leave the job site.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}