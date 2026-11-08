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
  // Working catalog selected by the owner from https://earist.edu.ph/graduate-school-2/.
  // Source history and client replacement dependencies remain in the feature ledger.
  programs: {
    groups: [
      {
        id: "masters",
        title: "Master's Programs",
        entries: [
          {
            name: "Master of Science in Mathematics",
            majors: [],
          },
          {
            name: "Master of Arts in Industrial Psychology",
            majors: [],
          },
          {
            name: "Master in Business Administration",
            majors: [],
          },
          {
            name: "Master in Public Administration",
            majors: [],
          },
          {
            name: "Master of Arts in Industrial Education",
            majors: ["Hotel and Restaurant Management"],
          },
          {
            name: "Master of Arts in Education",
            majors: [
              "Administration and Supervision",
              "Guidance and Counseling",
              "Special Education",
            ],
          },
          {
            name: "Master of Arts in Teaching (MAT)",
            majors: [
              "Electrical Technology",
              "Electronics Technology",
              "Mathematics",
              "Science",
            ],
          },
        ],
      },
      {
        id: "doctoral",
        title: "Doctoral Programs",
        entries: [
          {
            name: "Doctor of Philosophy in Industrial Psychology",
            majors: [],
          },
          {
            name: "Doctor of Education",
            majors: ["Educational Management"],
          },
          {
            name: "Doctor of Business Administration",
            majors: [],
          },
          {
            name: "Doctor of Public Administration",
            majors: [],
          },
        ],
      },
    ],
  },
  news: {
    sampleLabel: "Sample content — design review only",
    reviewNote: "Layout samples for review, not official announcements.",
    featured: {
      title: "Sample announcement headline",
      summary:
        "This sample shows how a featured Graduate School announcement could appear. It does not describe an official event or notice.",
    },
    items: [
      {
        title: "Sample Graduate School update",
        summary:
          "A short sample summary used to review headline length and spacing.",
      },
      {
        title: "Sample campus information",
        summary:
          "Placeholder copy for a text-only announcement in the public news section.",
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
  contact: {
    address: "Nagtahan St, Sampaloc, Manila, 1008 Metro Manila",
    email: "earistofficial1945@gmail.com",
    phone: "(02) 7738 5059",
    phoneHref: "tel:+63277385059",
    // Outgoing destinations read from the official EARIST site's navigation.
    // No social URL is inferred from the earlier page's plain-text handle.
    platforms: [
      {
        label: "EARIST Website",
        href: "https://earist.edu.ph/",
        description: "Official institutional website.",
      },
      {
        label: "Applicant Portal",
        href: "https://earistweb.pinnacle.com.ph/aims/applicants/",
        description: "Pinnacle Applicants Access Module.",
      },
      {
        label: "Applicant’s Inquiry (Facebook)",
        href: "https://www.facebook.com/mis.office.earist?mibextid=ZbWKwL",
        description: "Inquiry destination linked by the official EARIST site.",
      },
    ],
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
