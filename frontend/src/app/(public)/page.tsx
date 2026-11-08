import { HeroSection } from "@/components/landing/hero-section";
import { ProgramsSection } from "@/components/landing/programs-section";
import { RepositorySection } from "@/components/landing/repository-section";
import { AboutSection } from "@/components/landing/about-section";
import { GettingStartedSection } from "@/components/landing/getting-started-section";
import { AnnouncementsSection } from "@/components/landing/announcements-section";
import { ContactSection } from "@/components/landing/contact-section";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ProgramsSection />
      <AnnouncementsSection />
      <RepositorySection />
      <AboutSection />
      <GettingStartedSection />
      <ContactSection />
    </>
  );
}
