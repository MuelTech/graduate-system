"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { publicSiteContent } from "@/content/public-site-content";
import Image from "next/image";
import Link from "next/link";

// Local review features, not official news or events. Existing image provenance
// remains in the V2 asset ledger; no institutional photograph is implied.
const slides = [
  {
    title: "Graduate study at EARIST.",
    summary: publicSiteContent.hero.description,
    category: "Graduate School Highlights",
    image: publicSiteContent.hero.image,
    treatment: "photograph",
    primary: { label: "Explore Programs", href: "/#programs" },
    secondary: { label: "Entrance Examination", href: "/login" },
  },
  {
    title: "Registered in Pinnacle?",
    summary:
      "Sign in or create an account to view entrance examination schedules and access applicant services.",
    category: "Entrance Examination & Applicant Access",
    image: publicSiteContent.hero.examImage,
    treatment: "photograph",
    prerequisite: "A Pinnacle Applicant ID is required to create an account.",
    primary: { label: "Entrance Examination", href: "/login" },
    secondary: { label: "Create Account", href: "/register" },
  },
  {
    title: "Explore graduate research.",
    summary:
      "Browse published graduate theses, dissertations, abstracts, and citations in the Research Repository.",
    category: "Graduate Research",
    image: publicSiteContent.research.image,
    treatment: "photograph",
    primary: { label: "Browse Research Repository", href: "/repository" },
    secondary: { label: "Explore Programs", href: "/#programs" },
  },
];
const intervalMs = 8_000;
const transitionMs = 900;
const motionQuery = "(prefers-reduced-motion: reduce)";
type Direction = "forward" | "backward";
type SlideFrame = {
  active: number;
  previous: number | null;
  direction: Direction;
};

function subscribeEnvironment(onChange: () => void) {
  const motion = window.matchMedia(motionQuery);
  motion.addEventListener("change", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    motion.removeEventListener("change", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

// A stable primitive snapshot also gives SSR and initial hydration the same state.
function getEnvironment() {
  return (
    (!window.matchMedia(motionQuery).matches ? 1 : 0) |
    (!document.hidden ? 2 : 0)
  );
}

export function AnnouncementsSection() {
  const [{ active, previous, direction }, setFrame] = useState<SlideFrame>({
    active: 0,
    previous: null,
    direction: "forward",
  });
  const queuedSlide = useRef<{ index: number; direction: Direction } | null>(
    null,
  );
  const [paused, setPaused] = useState(false);
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
  const motionAllowed = Boolean(environment & 1);
  const documentVisible = Boolean(environment & 2);
  const rotating =
    !paused &&
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
    const timer = window.setTimeout(
      () =>
        setFrame((frame) => ({
          active: (frame.active + 1) % slides.length,
          previous: frame.active,
          direction: "forward",
        })),
      intervalMs,
    );
    return () => window.clearTimeout(timer);
  }, [rotating, active]);

  const finishTransition = useCallback(() => {
    if (previous === null) return;
    const queued = queuedSlide.current;
    queuedSlide.current = null;
    if (queued && queued.index !== active) {
      setFrame({
        active: queued.index,
        previous: motionAllowed ? active : null,
        direction: queued.direction,
      });
      setAnnouncement(
        `Announcement ${queued.index + 1} of ${slides.length}: ${slides[queued.index].title}`,
      );
    } else {
      setFrame((frame) => ({ ...frame, previous: null }));
    }
  }, [active, previous, motionAllowed]);

  useEffect(() => {
    if (previous === null) return;
    // Animation-end normally settles the frame. Also recover from a cancelled
    // animation, a background tab, or a motion-preference change mid-transition.
    const timer = window.setTimeout(
      finishTransition,
      motionAllowed ? transitionMs + 100 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [finishTransition, motionAllowed, previous]);

  function selectSlide(index: number, nextDirection: Direction = "forward") {
    const next = (index + slides.length) % slides.length;
    if (previous !== null) {
      queuedSlide.current = { index: next, direction: nextDirection };
      return;
    }
    if (next === active) return;
    setFrame({
      active: next,
      previous: motionAllowed ? active : null,
      direction: nextDirection,
    });
    setAnnouncement(
      `Announcement ${next + 1} of ${slides.length}: ${slides[next].title}`,
    );
  }

  function toggleRotation() {
    setPaused(!paused);
    if (paused) setFocusPaused(false);
  }

  return (
    <div
      ref={root}
      className="public-carousel"
      style={
        { "--public-carousel-duration": `${transitionMs}ms` } as CSSProperties
      }
      role="region"
      aria-roledescription="carousel"
      aria-label="News & Announcements"
      onPointerOver={(event) => {
        // Reading the image/text should not make autoplay look inactive.
        // Suspend while the pointer is over an action so it remains clickable.
        if (event.pointerType === "mouse") {
          setHovered(Boolean((event.target as Element).closest("a, button")));
        }
      }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={(event) =>
        setFocusPaused(event.target.matches(":focus-visible"))
      }
      onKeyDownCapture={() => setFocusPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocusPaused(false);
      }}
    >
      <div className="public-carousel__identity public-body-frame">
        <h1 id="landing-title">EARIST Graduate School</h1>
      </div>
      {motionAllowed && (
        <button
          type="button"
          className="public-carousel__rotation-toggle"
          aria-controls={carouselId}
          onClick={toggleRotation}
        >
          {paused ? "Resume slideshow" : "Pause slideshow"}
        </button>
      )}
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
              slide.treatment +
              (previous !== null && index === active
                ? " public-carousel__slide--entering"
                : "") +
              (index === previous ? " public-carousel__slide--leaving" : "")
            }
            data-active={index === active ? "true" : undefined}
            data-direction={direction}
            hidden={index !== active && index !== previous}
            aria-hidden={index !== active}
            inert={index !== active}
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget && index === active)
                finishTransition();
            }}
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
                  loading={index === 0 ? undefined : "eager"}
                />
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
              {slide.prerequisite && (
                <p className="public-carousel__prerequisite">
                  {slide.prerequisite}
                </p>
              )}
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
            onClick={() =>
              selectSlide(
                (queuedSlide.current?.index ?? active) - 1,
                "backward",
              )
            }
          >
            <ArrowLeft aria-hidden="true" size={22} />
          </button>
          <button
            className="public-carousel__arrow public-carousel__arrow--next"
            type="button"
            aria-label="Next announcement"
            aria-controls={carouselId}
            onClick={() =>
              selectSlide((queuedSlide.current?.index ?? active) + 1)
            }
          >
            <ArrowRight aria-hidden="true" size={22} />
          </button>
          <div className="public-carousel__controls public-body-frame">
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
          </div>
        </>
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
