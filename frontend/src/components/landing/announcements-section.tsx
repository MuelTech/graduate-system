"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { publicSiteContent } from "@/content/public-site-content";
import { PreviewImage } from "./preview-image";

// Existing fictional review imagery; provenance remains in the V2 asset ledger.
const slides = [
  { ...publicSiteContent.news.featured, image: publicSiteContent.hero.image },
  { ...publicSiteContent.news.items[0], image: publicSiteContent.about.image },
  {
    ...publicSiteContent.news.items[1],
    image: publicSiteContent.research.image,
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

export function AnnouncementsSection({ children }: { children?: ReactNode }) {
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
      className="public-opening__layout"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocusPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocusPaused(false);
      }}
    >
      <div
        className="public-carousel"
        role="region"
        aria-roledescription="carousel"
        aria-labelledby="news-title"
        aria-describedby="news-review-note"
      >
        <div
          id={carouselId}
          className="public-carousel__viewport"
          aria-live="off"
        >
          {slides.map((slide, index) => (
            <article
              key={slide.title}
              id={`${carouselId}-${index}`}
              className="public-carousel__slide"
              hidden={active !== index}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${slides.length}`}
            >
              <PreviewImage
                image={slide.image}
                className="public-carousel__image"
                sizes="(min-width: 1248px) 752px, (min-width: 900px) 62vw, (min-width: 600px) calc(100vw - 48px), calc(100vw - 36px)"
                priority={index === 0}
              />
              <div className="public-carousel__copy">
                <p className="public-carousel__sample">
                  {publicSiteContent.news.sampleLabel}
                </p>
                <h3>{slide.title}</h3>
                <p className="public-carousel__summary">{slide.summary}</p>
              </div>
            </article>
          ))}
        </div>

        {slides.length > 1 && (
          <div className="public-carousel__controls">
            <span className="public-carousel__position" aria-hidden="true">
              <strong>{String(active + 1).padStart(2, "0")}</strong> /{" "}
              {String(slides.length).padStart(2, "0")}
            </span>
            <div className="public-carousel__control-buttons">
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
                    <Pause aria-hidden="true" size={15} />
                  ) : (
                    <Play aria-hidden="true" size={15} />
                  )}
                  <span>{rotationRequested ? "Pause" : "Play"}</span>
                </button>
              )}
              <button
                type="button"
                aria-label="Previous announcement"
                aria-controls={carouselId}
                onClick={() => selectSlide(active - 1)}
              >
                <ArrowLeft aria-hidden="true" size={20} />
              </button>
              <button
                type="button"
                aria-label="Next announcement"
                aria-controls={carouselId}
                onClick={() => selectSlide(active + 1)}
              >
                <ArrowRight aria-hidden="true" size={20} />
              </button>
            </div>
          </div>
        )}
        <p role="status" className="sr-only">
          {announcement}
        </p>
      </div>

      <div className="public-opening__sidebar">
        <div className="public-opening__updates">
          <h3>In this preview</h3>
          <ol className="public-opening__update-list">
            {slides.map((slide, index) => (
              <li key={slide.title}>
                <button
                  type="button"
                  aria-label={`Show announcement ${index + 1}: ${slide.title}`}
                  aria-controls={`${carouselId}-${index}`}
                  aria-pressed={active === index}
                  onClick={() => selectSlide(index)}
                >
                  <span
                    className="public-opening__update-number"
                    aria-hidden="true"
                  >
                    0{index + 1}
                  </span>
                  <span>
                    <span className="public-opening__update-title">
                      {slide.title}
                    </span>
                    <span className="public-opening__update-label">
                      {publicSiteContent.news.sampleLabel}
                    </span>
                  </span>
                  <ArrowRight aria-hidden="true" size={18} />
                </button>
              </li>
            ))}
          </ol>
        </div>
        {children}
      </div>
    </div>
  );
}
