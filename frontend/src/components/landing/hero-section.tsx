import { AnnouncementsSection } from "./announcements-section";

export function HeroSection() {
  return (
    <section
      id="home"
      aria-labelledby="landing-title"
      className="public-opening"
    >
      <AnnouncementsSection />
    </section>
  );
}
