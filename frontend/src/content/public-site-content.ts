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
    programsHref: "/#programs",
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
  programs: {
    reviewNote:
      "Official EARIST references differ on majors and wording; client confirmation is pending.",
    sources: [
      { label: "Reference 1", href: "https://earist.edu.ph/graduate-school/" },
      {
        label: "Reference 2",
        href: "https://earist.edu.ph/graduate-school-2/",
      },
    ],
    // Curated degree names shared by both official pages above. Conflicting
    // major lists are intentionally omitted, not combined into a final catalog.
    groups: [
      {
        id: "masters",
        title: "Master's Programs",
        entries: [
          "Master of Science in Mathematics",
          "Master of Arts in Industrial Psychology",
          "Master in Business Administration",
          "Master in Public Administration",
        ],
      },
      {
        id: "doctoral",
        title: "Doctoral Programs",
        entries: [
          "Doctor of Philosophy in Industrial Psychology",
          "Doctor of Education",
          "Doctor of Business Administration",
          "Doctor of Public Administration",
        ],
      },
    ],
  },
  research: {
    image: {
      src: "/images/landing/v2/research-preview.webp",
      width: 1536,
      height: 1024,
      alt: "Generated illustration of a fictional library reading room with study tables and tropical greenery outside.",
      caption: "Design placeholder image — not EARIST photography",
    },
  },
  about: {
    image: {
      src: "/images/landing/v2/about-preview.webp",
      width: 1536,
      height: 1024,
      alt: "Generated illustration of a fictional seminar room with wooden tables, burgundy chairs, and a blank writing board.",
      caption: "Design placeholder image — not EARIST photography",
    },
  },
  gettingStarted: {
    faqs: [
      {
        id: "registration",
        question: "What do I need to register for GS-IS?",
        answer:
          "You need a Pinnacle Applicant ID before registering for GS-IS.",
        href: "/register",
        action: "Register for GS-IS",
      },
      {
        id: "account-access",
        question: "How do I access my existing account?",
        answer: "Use Sign In to access your existing GS-IS account.",
        href: "/login",
        action: "Sign In",
      },
      {
        id: "program-information",
        question: "Where can I explore graduate programs?",
        answer: "Open the Programs page to browse program information.",
        href: "/programs",
        action: "View Programs",
      },
      {
        id: "public-research",
        question: "Can I browse research without signing in?",
        answer:
          "Yes. Published titles, abstracts, and citations are public. Full-text access requires institutional sign-in where a manuscript is available.",
        href: "/repository",
        action: "Browse Research Repository",
      },
    ],
  },
} as const;
