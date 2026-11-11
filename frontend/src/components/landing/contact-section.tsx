import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
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
            <p className="public-body-eyebrow">Connect with Us</p>
            <h2 id="contact-title" className="public-body-title">
              Contact the Graduate School
            </h2>
          </div>
          <div>
            <p className="public-body-copy">
              Reach out to the EARIST Graduate School Office for academic
              inquiries, admissions guidance, or official portal assistance.
            </p>
          </div>
        </div>

        <div className="public-contact__columns">
          <div className="public-contact__info-stack">
            <div className="public-contact__panel">
              <h3 className="public-contact__group-title">
                Campus &amp; institutional contact
              </h3>
              <div className="public-contact__direct-list">
                <div className="public-contact__direct-item">
                  <span className="public-contact__icon">
                    <MapPin aria-hidden="true" size={18} />
                  </span>
                  <div>
                    <span className="public-contact__direct-label">
                      Campus Address
                    </span>
                    <address className="public-contact__address">
                      {contact.address}
                    </address>
                  </div>
                </div>

                <div className="public-contact__direct-item">
                  <span className="public-contact__icon">
                    <Mail aria-hidden="true" size={18} />
                  </span>
                  <div>
                    <span className="public-contact__direct-label">
                      Official Email
                    </span>
                    <a
                      href={`mailto:${contact.email}`}
                      className="public-contact__line"
                    >
                      {contact.email}
                    </a>
                  </div>
                </div>

                <div className="public-contact__direct-item">
                  <span className="public-contact__icon">
                    <Phone aria-hidden="true" size={18} />
                  </span>
                  <div>
                    <span className="public-contact__direct-label">
                      Telephone
                    </span>
                    <a
                      href={contact.phoneHref}
                      className="public-contact__line"
                    >
                      {contact.phone}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="public-contact__panel">
              <h3 className="public-contact__group-title">
                Official platforms &amp; portals
              </h3>
              <ul className="public-contact__platforms">
                {contact.platforms.map((platform) => (
                  <li key={platform.href}>
                    <a
                      href={platform.href}
                      className="public-contact__platform"
                    >
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
          </div>

          <InquiryForm />
        </div>
      </div>
    </section>
  );
}
