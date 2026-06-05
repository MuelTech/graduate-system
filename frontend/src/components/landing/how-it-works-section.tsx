import { FileEdit, GraduationCap, Trophy } from "lucide-react";

const steps = [
  {
    number: 1,
    icon: FileEdit,
    title: "Apply",
    description:
      "Submit your application and take the entrance examination online.",
  },
  {
    number: 2,
    icon: GraduationCap,
    title: "Enroll",
    description:
      "Complete enrollment via Pinnacle and upload your Certificate of Registration.",
  },
  {
    number: 3,
    icon: Trophy,
    title: "Succeed",
    description:
      "Navigate your thesis journey — from Title Defense to Final Defense and beyond.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="bg-[#E8F0FE] py-16 sm:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Title */}
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-[var(--earist-primary)] sm:text-4xl">
            How It Works
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-[var(--earist-body-text)]">
            Your journey from applicant to graduate in three simple steps.
          </p>
        </div>

        {/* Steps Cards */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.number}
              className="relative flex flex-col items-center rounded-lg bg-white p-8 text-center shadow-sm"
            >
              {/* Number Badge */}
              <div className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-[var(--earist-accent)] text-sm font-bold text-[var(--earist-primary)]">
                {step.number}
              </div>

              {/* Icon */}
              <div className="mb-4 mt-4 rounded-full bg-[var(--earist-primary)] p-4 text-white">
                <step.icon className="h-8 w-8" />
              </div>

              {/* Title */}
              <h3 className="mb-2 text-xl font-bold text-[var(--earist-primary)]">
                {step.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-[var(--earist-body-text)]">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
