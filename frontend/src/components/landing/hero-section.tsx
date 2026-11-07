import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HeroSection() {
  return (
    <section aria-labelledby="landing-title" className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Image
            src="/images/landing/earist-logo.jpg"
            alt="EARIST seal"
            width={56}
            height={56}
            className="shrink-0"
          />
          <p className="max-w-sm text-sm leading-relaxed text-(--earist-body-text)">
            Eulogio &quot;Amang&quot; Rodriguez Institute of Science and Technology
          </p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2 lg:items-end lg:gap-12">
          <div>
            <h1
              id="landing-title"
              className="text-4xl leading-tight font-bold tracking-tight text-(--earist-primary) sm:text-5xl lg:text-6xl"
            >
              <span className="block">EARIST</span>{" "}
              Graduate School
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-(--earist-body-text)">
              Graduate School Information System
            </p>
          </div>

          <div className="border-t border-(--earist-border-gray) pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
            <h2 className="text-xl font-semibold text-foreground">
              Applicant registration and account access
            </h2>
            <p
              id="registration-guidance"
              className="mt-3 max-w-md text-base leading-relaxed text-(--earist-body-text)"
            >
              New Applicants need a Pinnacle Applicant ID before registering for
              GS-IS.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/register"
                aria-describedby="registration-guidance"
                className={cn(
                  buttonVariants(),
                  "min-h-12 px-6 text-base whitespace-normal",
                )}
              >
                Register for GS-IS
              </Link>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "min-h-12 bg-white px-6 text-base whitespace-normal",
                )}
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>

        <nav
          aria-label="Public information"
          className="mt-12 flex flex-col gap-3 border-t border-(--earist-border-gray) pt-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-6"
        >
          <p className="text-sm text-(--earist-body-text)">
            Explore without signing in
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <Link
                href="#graduate-study"
                className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-(--earist-primary) underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                Programs
                <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
              </Link>
            </li>
            <li>
              <Link
                href="#graduate-research"
                className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-(--earist-primary) underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                Research Repository
                <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </section>
  );
}
