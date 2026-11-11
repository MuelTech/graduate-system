import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget";
import "./public-site.css";

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
