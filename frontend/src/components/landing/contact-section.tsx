import { ArrowUpRight } from "lucide-react";
import { publicSiteContent } from "@/content/public-site-content";

export function ContactSection() {
  const { contact } = publicSiteContent;

  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      aria-describedby="contact-review-note"
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
              Use the official contact and platform references below for
              institutional inquiries.
            </p>
            <p id="contact-review-note" className="public-contact__review-note">
              {contact.reviewNote}
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
            <a href={contact.sourceHref} className="public-contact__source">
              Source: Graduate School reference 2
            </a>

            <div className="public-contact__earlier">
              <h4>Earlier Graduate School listing</h4>
              <a
                href={contact.graduateSchoolReference.phoneHref}
                className="public-contact__line"
              >
                {contact.graduateSchoolReference.phone}
              </a>
              <p>
                Facebook/Twitter handle:{" "}
                <span>{contact.graduateSchoolReference.socialHandle}</span>
              </p>
              <a
                href={contact.graduateSchoolReference.sourceHref}
                className="public-contact__source"
              >
                View official reference · confirm current details
              </a>
            </div>
          </div>

          <div>
            <h3 className="public-contact__group-title">Official platforms</h3>
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
        </div>
      </div>
    </section>
  );
}
