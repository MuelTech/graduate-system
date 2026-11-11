"use client";

import { useState, type FormEvent } from "react";
import { publicSiteContent } from "@/content/public-site-content";

export function InquiryForm() {
  const [message, setMessage] = useState("");
  const email = publicSiteContent.contact.email;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    for (const id of ["inquiry-name", "inquiry-subject", "inquiry-message"]) {
      const field = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `#${id}`,
      )!;
      field.setCustomValidity(
        field.value.trim() ? "" : "Please complete this field.",
      );
    }
    if (!form.reportValidity()) return;
    setMessage(
      "Your inquiry has not been sent. Please contact us by email. Your entries remain in this form.",
    );
  }

  return (
    <form
      className="public-inquiry"
      onSubmit={submit}
      aria-labelledby="inquiry-title"
      aria-describedby="inquiry-availability"
    >
      <h3 id="inquiry-title" className="public-contact__group-title">
        Send an inquiry
      </h3>
      <p id="inquiry-availability" className="public-inquiry__notice">
        Direct form delivery is currently offline. For immediate assistance,
        please email <a href={`mailto:${email}`}>{email}</a>.
      </p>
      <div className="public-inquiry__fields">
        <label htmlFor="inquiry-name">
          Full Name <span>(required)</span>
          <input
            id="inquiry-name"
            autoComplete="name"
            required
            onInput={(e) => e.currentTarget.setCustomValidity("")}
          />
        </label>
        <label htmlFor="inquiry-email">
          Email Address <span>(required)</span>
          <input
            id="inquiry-email"
            type="email"
            autoComplete="email"
            required
          />
        </label>
        <label htmlFor="inquiry-phone">
          Contact Number <span>(optional)</span>
          <input id="inquiry-phone" type="tel" autoComplete="tel" />
        </label>
        <label htmlFor="inquiry-subject">
          Subject <span>(required)</span>
          <input
            id="inquiry-subject"
            required
            onInput={(e) => e.currentTarget.setCustomValidity("")}
          />
        </label>
        <label htmlFor="inquiry-message">
          Message / Inquiry <span>(required)</span>
          <textarea
            id="inquiry-message"
            rows={5}
            required
            onInput={(e) => e.currentTarget.setCustomValidity("")}
          />
        </label>
      </div>
      <label className="public-inquiry__privacy" htmlFor="inquiry-privacy">
        <input id="inquiry-privacy" type="checkbox" required />
        <span>
          I acknowledge that the information I provide will be used to respond
          to my inquiry.
        </span>
      </label>
      <button type="submit" className="public-action public-action--primary">
        Send Inquiry
      </button>
      <p role="status" className="public-inquiry__status">
        {message}
      </p>
    </form>
  );
}
