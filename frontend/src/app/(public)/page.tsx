import { HeroSection } from "@/components/landing/hero-section";
import { ProgramsSection } from "@/components/landing/programs-section";
import { RepositorySection } from "@/components/landing/repository-section";
import { AboutSection } from "@/components/landing/about-section";
import { GettingStartedSection } from "@/components/landing/getting-started-section";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ProgramsSection />
      <RepositorySection />
      <AboutSection />
      <GettingStartedSection />
    </>
  );
}
