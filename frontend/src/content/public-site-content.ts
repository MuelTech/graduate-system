// Local presentation content only. No API, registration, or public-data contract.
export const publicSiteContent = {
  institution: {
    fullName: 'Eulogio "Amang" Rodriguez Institute of Science and Technology',
    sealSrc: "/images/landing/earist-logo.jpg",
  },
  previewNotice:
    "Design preview — marked imagery and sample content are for review only.",
  hero: {
    serviceLabel: "Graduate School Information System",
    description:
      "Explore graduate programs, published research, and information for applicants and the EARIST academic community.",
    // Task 1 retains the existing target; Task 2 introduces /#programs.
    programsHref: "/#graduate-study",
    registrationGuidance: "A Pinnacle Applicant ID is required.",
    image: {
      src: "/images/landing/v2/hero-campus-preview.webp",
      width: 1536,
      height: 1024,
      alt: "Generated illustration of a fictional academic courtyard with shaded walkways and tropical trees.",
      caption: "Design placeholder image — not EARIST photography",
      // Built-in image_gen. Full prompt/provenance and production replacement gate:
      // docs/superpowers/reports/2026-11-08-landing-page-redesign-v2-assets.md.
    },
  },
} as const;
