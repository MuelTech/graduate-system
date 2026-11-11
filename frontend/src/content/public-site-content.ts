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
      "Advance your professional practice, scholarship, and leadership through master's and doctoral studies at EARIST.",
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
    examImage: {
      src: "/images/landing/v2/exam-preview.jpg",
      width: 1376,
      height: 768,
      alt: "Generated illustration of a fictional academic examination and assessment hall with wooden desks and warm daylight.",
      caption: "Design placeholder image — not EARIST photography",
    },
  },
  // Working catalog selected by the owner from https://earist.edu.ph/graduate-school-2/.
  // Source history and client replacement dependencies remain in the feature ledger.
  programs: {
    sourceHref: "https://earist.edu.ph/graduate-school-2/",
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
    posts: [
      {
        id: "comprehensive-exam-passers-2026",
        category: "Examination Results",
        publishedAt: "September 6, 2026",
        title: "Congratulations, Comprehensive Examination Passers!",
        content: `The EARIST Graduate School proudly congratulates all graduate students who successfully passed the Comprehensive Examination held on September 6, 2026!

Your success is a testament to your dedication, perseverance, and commitment to academic excellence. This achievement marks another significant milestone in your graduate school journey and brings you one step closer to completing your degree.

May this accomplishment inspire you to continue pursuing excellence as you move forward to the next stage of your academic journey.

Congratulations, Passers!
Excellence • Integrity • Service`,
        images: [
          {
            src: "/images/landing/news/comprehensive-exam-passers-cover.jpg",
            width: 671,
            height: 951,
            alt: "EARIST Graduate School List of Passers poster for the Comprehensive Examination held on September 6, 2026.",
          },
          {
            src: "/images/landing/news/comprehensive-exam-passers-edd.jpg",
            width: 663,
            height: 953,
            alt: "List of Comprehensive Examination passers for Doctor of Education Major in Educational Management (13 passers).",
          },
          {
            src: "/images/landing/news/comprehensive-exam-passers-phd-psych.jpg",
            width: 664,
            height: 955,
            alt: "List of Comprehensive Examination passers for Doctor of Philosophy in Industrial Psychology (4 passers).",
          },
          {
            src: "/images/landing/news/comprehensive-exam-passers-maed.jpg",
            width: 669,
            height: 954,
            alt: "List of Comprehensive Examination passers for Master of Arts in Education Major in Administration and Supervision (7 passers).",
          },
        ],
      },
      {
        id: "comprehensive-exam-rescheduled-2026",
        category: "Important Announcement",
        publishedAt: "September 6, 2026",
        title: "Comprehensive Examination Rescheduled to September 6, 2026",
        content: `Please be informed that the Graduate School Comprehensive Examination has been RESCHEDULED to September 6, 2026 (Sunday).

Call Time: 7:00 AM
Testing Rooms: The list of assigned testing rooms will be available at the Graduate School Office.

All examinees are reminded to arrive at their assigned testing rooms by 7:00 AM, bring the necessary examination requirements, and observe proper examination protocols.

See you tomorrow, examinees!
Please stay safe, and good luck!

GRADUATE SCHOOL
EARIST`,
        images: [
          {
            src: "/images/landing/news/comprehensive-exam-rescheduled.jpg",
            width: 789,
            height: 950,
            alt: "EARIST Graduate School announcement poster: Comprehensive Examination rescheduled to September 6, 2026 (Sunday) with 7:00 AM call time.",
          },
        ],
      },
      {
        id: "enrollment-extended-habagat-2026",
        category: "Enrollment Advisory",
        publishedAt: "September 3, 2026",
        title: "Graduate School Enrollment Extended Until September 3, 2026",
        content: `Dear EARIST Graduate School Students,

In consideration of the prevailing Southwest Monsoon (Habagat) and to provide students from affected areas sufficient time to complete their enrollment, the Graduate School enrollment period is extended until September 3, 2026.

We encourage all students who have not yet completed their enrollment to take advantage of this extension and accomplish the necessary requirements within the extended period.

Most importantly, please prioritize your safety. Avoid unnecessary travel, stay updated with weather advisories, and follow the guidance of local authorities, especially those in areas affected by heavy rains and flooding.

Stay safe, everyone! Take care and be guided accordingly.

EARIST Graduate School
Excellence. Innovation. Service. Since 1945.`,
        images: [
          {
            src: "/images/landing/news/enrollment-extended-habagat.jpg",
            width: 946,
            height: 955,
            alt: "EARIST Graduate School announcement poster: Enrollment extended until September 3, 2026 due to the Southwest Monsoon.",
          },
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
    // Goal summaries: https://earist.edu.ph/graduate-school/ (Graduate School Goals).
    // Institutional context: https://earist.edu.ph/about/ (EARIST Goals).
    // Keep these scopes distinct; neither source describes software/platform goals.
    sourceHref: "https://earist.edu.ph/graduate-school/",
    introduction:
      "Graduate study at EARIST connects professional development, research, and leadership through its master's and doctoral programs.",
    goals: [
      {
        title: "Professional practice",
        description:
          "Strengthen professional practice and leadership among educators, business and industry leaders, practitioners, and civil servants.",
      },
      {
        title: "Knowledge and research",
        description:
          "Advance knowledge and technology through relevant, innovative research.",
      },
      {
        title: "Values and leadership",
        description:
          "Encourage values and attitudes that support proactive, progressive, and transformative leadership and management.",
      },
    ],
    institutionSourceHref: "https://earist.edu.ph/about/",
    institutionalContext:
      "EARIST's institution-wide goals cover instruction and training across trades, business, arts, sciences, and technology. They also include research, advanced studies, and progressive leadership.",
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
