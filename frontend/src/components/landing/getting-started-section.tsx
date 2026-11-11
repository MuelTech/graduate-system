import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { publicSiteContent } from "@/content/public-site-content";

export function GettingStartedSection() {
  return (
    <section
      id="getting-started"
      aria-labelledby="getting-started-title"
      className="public-body-section public-help"
    >
      <div className="public-body-frame public-help__layout">
        <div>
          <p className="public-body-eyebrow">Help &amp; account access</p>
          <h2 id="getting-started-title" className="public-body-title">
            Getting started
          </h2>
          <p className="public-body-copy">
            Find the right starting point for GS-IS registration, account
            access, and public information.
          </p>
        </div>
        <div id="faq" className="public-help__questions">
          <h3 className="public-help__title">Frequently asked questions</h3>
          {publicSiteContent.gettingStarted.faqs.map((faq, index) => (
            <details
              key={faq.id}
              className="public-help__item"
              open={index === 0}
            >
              <summary className="public-help__question">
                <span>{faq.question}</span>
                <Plus aria-hidden="true" size={18} />
              </summary>
              <div className="public-help__answer">
                <p>{faq.answer}</p>
                <Link href={faq.href} className="public-body-link">
                  {faq.action} <ArrowRight aria-hidden="true" size={16} />
                </Link>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
