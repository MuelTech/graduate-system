import {
  ClipboardCheck,
  FileText,
  Calendar,
  Shield,
  Bell,
  MessageSquare,
} from "lucide-react";

const features = [
  {
    icon: ClipboardCheck,
    title: "Streamlined Admissions",
    description:
      "Complete your application process online — from registration to entrance examination scheduling and COR upload.",
  },
  {
    icon: FileText,
    title: "Thesis Pipeline Management",
    description:
      "Track your thesis journey from title defense through proposal to final defense with clear status indicators.",
  },
  {
    icon: Calendar,
    title: "Exam Scheduling",
    description:
      "Select and manage your examination slots with real-time availability and automated email reminders.",
  },
  {
    icon: Shield,
    title: "Plagiarism Check",
    description:
      "Integrated STRIKE plagiarism detection to ensure academic integrity with threshold-based pass/fail results.",
  },
  {
    icon: Bell,
    title: "Real-time Notifications",
    description:
      "Stay updated with instant notifications for status changes, approvals, deadlines, and announcements.",
  },
  {
    icon: MessageSquare,
    title: "AI Chatbot Assistant",
    description:
      "Get instant help with our NLP-powered chatbot for navigation guidance, FAQs, and system support.",
  },
];

export function FeaturesSection() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-[var(--earist-secondary)] sm:text-4xl">
            Everything You Need
          </h2>
          <p className="mb-12 text-lg text-[var(--earist-body-text)]">
            Our comprehensive platform manages the complete student lifecycle
            from application to research repository archiving.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-lg border border-[var(--earist-border-gray)] bg-[var(--earist-surface-light-red)] p-6 transition-all hover:border-[var(--earist-accent)] hover:shadow-lg"
            >
              <div className="mb-4 inline-flex rounded-lg bg-[var(--earist-primary)] p-3 text-white transition-colors group-hover:bg-[var(--earist-accent)]">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-[var(--earist-primary)]">
                {feature.title}
              </h3>
              <p className="text-sm text-[var(--earist-body-text)]">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
