"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { publicSiteContent } from "@/content/public-site-content";
import Image from "next/image";
import Link from "next/link";

// Local review features, not official news or events. Existing image provenance
// remains in the V2 asset ledger; no institutional photograph is implied.
const slides = [
  {
    title: "Graduate study at EARIST.",
    summary: publicSiteContent.hero.description,
    category: "News & Announcements",
    image: publicSiteContent.hero.image,
    treatment: "photograph",
    primary: { label: "Explore Programs", href: "/#programs" },
    secondary: { label: "Entrance Examination", href: "/login" },
  },
  {
    title: "Registered in Pinnacle?",
    summary:
      "Sign in or create an account to access examination services.",
    category: "Applicant examination access",
    treatment: "statement",
    primary: { label: "Entrance Examination", href: "/login" },
    secondary: { label: "Create Account", href: "/register" },
  },
  {
    title: "Explore graduate research.",
    summary:
      "Explore published graduate research titles, abstracts, and citations in the Research Repository.",
    category: "Research Repository",
    image: publicSiteContent.research.image,
    treatment: "photograph",
    primary: { label: "Browse Research Repository", href: "/repository" },
    secondary: { label: "Explore Programs", href: "/#programs" },
  },
];
const intervalMs = 8_000;
const desktopQuery = "(min-width: 900px)";
const motionQuery = "(prefers-reduced-motion: reduce)";

function subscribeEnvironment(onChange: () => void) {
  const desktop = window.matchMedia(desktopQuery);
  const motion = window.matchMedia(motionQuery);
  desktop.addEventListener("change", onChange);
  motion.addEventListener("change", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    desktop.removeEventListener("change", onChange);
    motion.removeEventListener("change", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

// A stable primitive snapshot also gives SSR and initial hydration the same state.
function getEnvironment() {
  return (
    (window.matchMedia(desktopQuery).matches ? 1 : 0) |
    (!window.matchMedia(motionQuery).matches ? 2 : 0) |
    (!document.hidden ? 4 : 0)
  );
}

export function AnnouncementsSection() {
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState<"auto" | "playing" | "paused">("auto");
  const [hovered, setHovered] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const carouselId = useId();
  const environment = useSyncExternalStore(
    subscribeEnvironment,
    getEnvironment,
    () => 0,
  );
  const desktop = Boolean(environment & 1);
  const motionAllowed = Boolean(environment & 2);
  const documentVisible = Boolean(environment & 4);
  const rotationRequested = mode === "playing" || (mode === "auto" && desktop);
  const rotating =
    rotationRequested &&
    motionAllowed &&
    documentVisible &&
    inView &&
    !hovered &&
    !focusPaused;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.25 },
    );
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!rotating || slides.length < 2) return;
    const timer = window.setInterval(
      () => setActive((index) => (index + 1) % slides.length),
      intervalMs,
    );
    return () => window.clearInterval(timer);
  }, [rotating]);

  function selectSlide(index: number) {
    const next = (index + slides.length) % slides.length;
    setMode("paused");
    setActive(next);
    setAnnouncement(
      `Announcement ${next + 1} of ${slides.length}: ${slides[next].title}`,
    );
  }

  function toggleRotation() {
    setMode(rotationRequested ? "paused" : "playing");
    // Explicit Play may resume with focus on its own control. The next focus
    // change pauses again; mouse hover still suspends rotation until it leaves.
    if (!rotationRequested) setFocusPaused(false);
  }

  return (
    <div
      ref={root}
      className="public-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="News & Announcements"
      aria-describedby="news-review-note"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocusPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocusPaused(false);
      }}
    >
      <div className="public-carousel__identity public-body-frame">
        <h1 id="landing-title">EARIST Graduate School</h1>
      </div>
      <p id="news-review-note" className="sr-only">
        {publicSiteContent.news.reviewNote}
      </p>
      <div
        id={carouselId}
        className="public-carousel__viewport"
        aria-live="off"
      >
        {slides.map((slide, index) => (
          <article
            key={slide.title}
            id={carouselId + "-" + index}
            className={
              "public-carousel__slide public-carousel__slide--" +
              slide.treatment
            }
            hidden={active !== index}
            role="group"
            aria-roledescription="slide"
            aria-label={index + 1 + " of " + slides.length}
          >
            {slide.image && (
              <figure className="public-carousel__image">
                <Image
                  src={slide.image.src}
                  alt={slide.image.alt}
                  fill
                  sizes="100vw"
                  priority={index === 0}
                />
                <figcaption>{slide.image.caption}</figcaption>
              </figure>
            )}
            <div className="public-carousel__copy public-body-frame">
              <p className="public-carousel__category">{slide.category}</p>
              <h2>{slide.title}</h2>
              <p className="public-carousel__summary">{slide.summary}</p>
              <div className="public-carousel__actions">
                <Link
                  href={slide.primary.href}
                  className="public-carousel__action public-carousel__action--primary"
                >
                  {slide.primary.label}{" "}
                  <ArrowRight aria-hidden="true" size={19} />
                </Link>
                <Link
                  href={slide.secondary.href}
                  className="public-carousel__action public-carousel__action--secondary"
                >
                  {slide.secondary.label}{" "}
                  <ArrowRight aria-hidden="true" size={19} />
                </Link>
              </div>
              {slide.treatment === "statement" && (
                <p className="public-carousel__prerequisite">
                  A Pinnacle Applicant ID is required to create an account.
                </p>
              )}
              <p className="public-carousel__sample">
                {publicSiteContent.news.sampleLabel}
              </p>
            </div>
          </article>
        ))}
      </div>
      {slides.length > 1 && (
        <>
          <button
            className="public-carousel__arrow public-carousel__arrow--previous"
            type="button"
            aria-label="Previous announcement"
            aria-controls={carouselId}
            onClick={() => selectSlide(active - 1)}
          >
            <ArrowLeft aria-hidden="true" size={22} />
          </button>
          <button
            className="public-carousel__arrow public-carousel__arrow--next"
            type="button"
            aria-label="Next announcement"
            aria-controls={carouselId}
            onClick={() => selectSlide(active + 1)}
          >
            <ArrowRight aria-hidden="true" size={22} />
          </button>
          <div className="public-carousel__controls public-body-frame">
            <span className="public-carousel__position" aria-hidden="true">
              {String(active + 1).padStart(2, "0")} /{" "}
              {String(slides.length).padStart(2, "0")}
            </span>
            <div
              className="public-carousel__indicators"
              role="group"
              aria-label="Choose announcement"
            >
              {slides.map((slide, index) => (
                <button
                  key={slide.title}
                  type="button"
                  aria-label={
                    "Show announcement " + (index + 1) + ": " + slide.title
                  }
                  aria-controls={carouselId + "-" + index}
                  aria-pressed={active === index}
                  onClick={() => selectSlide(index)}
                >
                  <span />
                </button>
              ))}
            </div>
            {motionAllowed && (
              <button
                type="button"
                className="public-carousel__playback"
                aria-label={
                  rotationRequested
                    ? "Pause announcement rotation"
                    : "Play announcement rotation"
                }
                aria-controls={carouselId}
                onClick={toggleRotation}
              >
                {rotationRequested ? (
                  <Pause aria-hidden="true" size={16} />
                ) : (
                  <Play aria-hidden="true" size={16} />
                )}
                <span>{rotationRequested ? "Pause" : "Play"}</span>
              </button>
            )}
          </div>
        </>
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
