import { ArrowUpRight } from "lucide-react";
import { InquiryForm } from "./inquiry-form";
import { publicSiteContent } from "@/content/public-site-content";

export function ContactSection() {
  const { contact } = publicSiteContent;

  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      className="public-body-section public-contact"
    >
      <div className="public-body-frame">
        <div className="public-contact__intro">
          <div>
            <p className="public-body-eyebrow">Institutional information</p>
            <h2 id="contact-title" className="public-body-title">
              Contact Us
            </h2>
          </div>
          <div>
            <p className="public-body-copy">
              Contact EARIST or use the platforms below for institutional
              inquiries.
            </p>
          </div>
        </div>

        <div className="public-contact__columns">
          <div>
            <h3 className="public-contact__group-title">
              Campus &amp; institutional contact
            </h3>
            <address className="public-contact__address">
              {contact.address}
            </address>
            <a
              href={`mailto:${contact.email}`}
              className="public-contact__line"
            >
              {contact.email}
            </a>
            <a href={contact.phoneHref} className="public-contact__line">
              {contact.phone}
            </a>

            <h3 className="public-contact__group-title public-contact__platform-title">
              Official platforms
            </h3>
            <ul className="public-contact__platforms">
              {contact.platforms.map((platform) => (
                <li key={platform.href}>
                  <a href={platform.href} className="public-contact__platform">
                    <span>
                      <strong>{platform.label}</strong>
                      <span className="public-contact__platform-description">
                        {platform.description}
                      </span>
                    </span>
                    <ArrowUpRight aria-hidden="true" size={20} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <InquiryForm />
        </div>
      </div>
    </section>
  );
}
