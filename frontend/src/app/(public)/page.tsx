import { HeroSection } from "@/components/landing/hero-section";
import { ProgramsSection } from "@/components/landing/programs-section";
import { RepositorySection } from "@/components/landing/repository-section";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ProgramsSection />
      <RepositorySection />
    </>
  );
}
