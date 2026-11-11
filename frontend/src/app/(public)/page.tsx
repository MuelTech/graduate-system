import { HeroSection } from "@/components/landing/hero-section";
import { NewsSection } from "@/components/landing/news-section";
import { ProgramsSection } from "@/components/landing/programs-section";
import { RepositorySection } from "@/components/landing/repository-section";
import { AboutSection } from "@/components/landing/about-section";
import { ContactSection } from "@/components/landing/contact-section";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <NewsSection />
      <AboutSection />
      <ProgramsSection />
      <RepositorySection />
      <ContactSection />
    </>
  );
}
