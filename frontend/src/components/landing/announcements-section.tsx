import { publicSiteContent } from "@/content/public-site-content";

export function AnnouncementsSection() {
  const { news } = publicSiteContent;

  return (
    <section
      id="news"
      aria-labelledby="news-title"
      aria-describedby="news-review-note"
      className="public-body-section public-news"
    >
      <div className="public-body-frame">
        <div className="public-news__intro">
          <div>
            <p className="public-body-eyebrow">News &amp; updates</p>
            <h2 id="news-title" className="public-body-title">
              News &amp; Announcements
            </h2>
          </div>
          <p id="news-review-note" className="public-body-copy">
            {news.reviewNote}
          </p>
        </div>
        <div className="public-news__layout">
          <article className="public-news__feature">
            <p className="public-news__sample-label">{news.sampleLabel}</p>
            <h3>{news.featured.title}</h3>
            <p className="public-news__summary">{news.featured.summary}</p>
          </article>
          <div className="public-news__list">
            {news.items.map((item) => (
              <article key={item.title} className="public-news__item">
                <p className="public-news__sample-label">{news.sampleLabel}</p>
                <h3>{item.title}</h3>
                <p className="public-news__summary">{item.summary}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
