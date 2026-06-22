"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Search, HelpCircle } from "lucide-react";

const faqCategories = [
  {
    title: "Admissions & Application",
    faqs: [
      {
        question: "How do I apply to the EARIST Graduate School?",
        answer:
          "To apply, you must first register in Pinnacle to obtain your Applicant ID. Then, visit our registration page to complete your GS System registration, including personal information, program selection, and account setup.",
      },
      {
        question: "What is the Program Alignment Check?",
        answer:
          "The Program Alignment Check automatically verifies if your undergraduate program is aligned with your intended graduate program. If aligned, you can proceed immediately. If misaligned, you may need to submit a Bridging Waiver form.",
      },
      {
        question: "What documents do I need for application?",
        answer:
          "Document submission and payment are handled entirely through Pinnacle. You will need to register in Pinnacle first, obtain your Applicant ID, and complete all requirements there before returning to the GS System.",
      },
      {
        question: "How do I schedule my entrance examination?",
        answer:
          "After completing registration and passing the Program Alignment Check, you can select an available exam slot through the Exam Scheduling page in your Applicant Portal. Note that exam scheduling is blocked if your alignment status is 'pending waiver'.",
      },
    ],
  },
  {
    title: "Enrollment & Registration",
    faqs: [
      {
        question: "What is Pinnacle and how do I use it?",
        answer:
          "Pinnacle is the institutional enrollment system used by EARIST. It handles Applicant ID issuance, initial payment processing, enrollment, and COR (Certificate of Registration) generation. You must complete your enrollment through Pinnacle after passing the entrance examination.",
      },
      {
        question: "How do I upload my Certificate of Registration (COR)?",
        answer:
          "After completing enrollment in Pinnacle and downloading your COR, navigate to the COR Upload page in your Applicant Portal. Upload the PDF/JPG/PNG file (max 5MB) and the system will extract your data using OCR for verification.",
      },
      {
        question: "What happens after my COR is verified?",
        answer:
          "Once your COR is verified by the Administrator, you will be promoted to Student role. Your credentials (Student Number and initial password based on your Date of Birth) will be sent to your registered email address.",
      },
    ],
  },
  {
    title: "Thesis & Defense",
    faqs: [
      {
        question: "What are the stages of the thesis pipeline?",
        answer:
          "The thesis pipeline consists of three stages: Title Defense, Proposal Defense, and Final Defense. Each stage has specific requirements that must be completed before advancing to the next stage.",
      },
      {
        question: "How do I apply for Title Defense?",
        answer:
          "To apply for Title Defense, you need: Certificate of Comprehensive Exam (Passed), COR for the current semester, Application for Defense form, and Three Proposed Titles. Upload all requirements through the Title Defense Application page.",
      },
      {
        question: "What is the STRIKE plagiarism check?",
        answer:
          "STRIKE is an integrated plagiarism detection system. Your manuscript must have a similarity score BELOW 20% to pass. You can submit your manuscript through the STRIKE Plagiarism Check page and view detailed results including similarity percentage.",
      },
      {
        question: "What is a RAP Report?",
        answer:
          "RAP (Research Assessment Panel) Report is generated after each defense stage. It contains the panel's evaluation and recommendations. Panelists must e-sign the report before it is finalized and made available for download.",
      },
    ],
  },
  {
    title: "System Access & Technical",
    faqs: [
      {
        question: "What are the different user roles in the system?",
        answer:
          "The system has five user roles: Applicant (pre-enrollment), Student (enrolled), Panelist (defense panel members), Administrator (GS staff), and Custom (admin-defined roles). Each role has access to specific portals and features.",
      },
      {
        question: "I forgot my password. How do I reset it?",
        answer:
          "Click the 'Forgot your password?' link on the login page. Enter your registered email address and follow the instructions sent to your email to reset your password.",
      },
      {
        question: "Can I change my graduate program after enrollment?",
        answer:
          "No. Enrolled students cannot change their graduate programs under any circumstances. This is a permanent institutional policy effective from Schema v8 onwards.",
      },
      {
        question: "How do I access the AI Chatbot?",
        answer:
          "The AI Chatbot is available as a floating button (bottom-right corner) on all pages for all authenticated users. It can help with navigation, thesis FAQs, exam scheduling guidance, and alignment check information.",
      },
    ],
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-(--earist-border-gray)">
      <button
        className="flex w-full items-center justify-between py-4 text-left"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="pr-4 text-sm font-medium text-(--earist-primary)">
          {question}
        </span>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-(--earist-secondary)" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-(--earist-body-text)" />
        )}
      </button>
      {isOpen && (
        <div className="pr-8 pb-4 pl-0">
          <p className="text-sm text-(--earist-body-text)">{answer}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  return (
    <>
      {/* Page Header */}
      <section className="bg-(--earist-primary) py-16">
        <div className="container mx-auto px-4 text-center sm:px-6 lg:px-8">
          <h1 className="mb-4 text-4xl font-bold text-white">
            FAQ / Help Center
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-white/80">
            Find answers to frequently asked questions about the EARIST Graduate
            School Information System.
          </p>
        </div>
      </section>

      {/* Search */}
      <section className="bg-(--earist-surface-gray) py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-xl">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-(--earist-body-text)" />
              <input
                type="text"
                placeholder="Search frequently asked questions..."
                className="w-full rounded-lg border border-(--earist-border-gray) bg-white py-3 pr-4 pl-10 text-sm transition-colors focus:border-(--earist-primary) focus:ring-1 focus:ring-(--earist-primary) focus:outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Categories */}
      <section className="bg-white py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl space-y-10">
            {faqCategories.map((category) => (
              <div key={category.title}>
                <div className="mb-4 flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-(--earist-accent)" />
                  <h2 className="text-xl font-bold text-(--earist-primary)">
                    {category.title}
                  </h2>
                </div>
                <div className="rounded-lg border border-(--earist-border-gray) bg-white px-6">
                  {category.faqs.map((faq) => (
                    <FAQItem
                      key={faq.question}
                      question={faq.question}
                      answer={faq.answer}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Support */}
      <section className="bg-(--earist-surface-light-red) py-12">
        <div className="container mx-auto px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-2xl font-bold text-(--earist-primary)">
            Still Have Questions?
          </h2>
          <p className="mb-6 text-(--earist-body-text)">
            Contact the Graduate School Office for further assistance.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="mailto:gs@earist.edu.ph"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-(--earist-primary) px-6 text-sm font-semibold text-white transition-colors hover:bg-(--earist-primary)/90"
            >
              Email Support
            </a>
            <a
              href="tel:+63285348267"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-(--earist-primary) px-6 text-sm font-semibold text-(--earist-primary) transition-colors hover:bg-(--earist-surface-light-red)"
            >
              Call Us
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
