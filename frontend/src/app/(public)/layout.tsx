import type { Metadata } from "next";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget";
import "./public-site.css";

export const metadata: Metadata = {
  title: "EARIST - Graduate School",
  description:
    'Advance your professional practice, scholarship, and leadership through master\'s and doctoral studies at Eulogio "Amang" Rodriguez Institute of Science and Technology (EARIST).',
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="earist-public flex min-h-screen flex-col">
      <a href="#public-main-content" className="public-skip-link">
        Skip to main content
      </a>
      <Navbar />
      <main
        id="public-main-content"
        tabIndex={-1}
        className="public-main flex-1"
      >
        {children}
      </main>
      <Footer />
      <ChatbotWidget />
    </div>
  );
}
