"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Images,
  X,
} from "lucide-react";
import { publicSiteContent } from "@/content/public-site-content";

type NewsPost = (typeof publicSiteContent.news.posts)[number];

export function NewsSection() {
  const { posts } = publicSiteContent.news;
  const [selectedPost, setSelectedPost] = useState<NewsPost | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogTitleId = useId();

  function openPost(post: NewsPost) {
    setSelectedPost(post);
    setActiveImageIndex(0);
  }

  function closePost() {
    setSelectedPost(null);
    setActiveImageIndex(0);
  }

  useEffect(() => {
    if (!selectedPost) return;
    closeButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePost();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPost]);

  const activeImage = selectedPost?.images[activeImageIndex];

  return (
    <section
      id="news"
      aria-labelledby="news-announcements-title"
      className="public-body-section public-news"
    >
      <div className="public-body-frame">
        <div className="public-news__intro">
          <div>
            <p className="public-body-eyebrow">News &amp; Announcements</p>
            <h2 id="news-announcements-title" className="public-body-title">
              Graduate School updates and advisories
            </h2>
          </div>
          <div>
            <p className="public-body-copy">
              Read official examination results, schedule advisories, and
              enrollment announcements from the EARIST Graduate School.
            </p>
          </div>
        </div>

        <div className="public-news__grid">
          {posts.map((post) => {
            const coverImage = post.images[0];
            return (
              <article key={post.id} className="public-news__card">
                <button
                  type="button"
                  className="public-news__card-media"
                  onClick={() => openPost(post)}
                  aria-label={`View announcement: ${post.title}`}
                >
                  <Image
                    src={coverImage.src}
                    alt={coverImage.alt}
                    width={coverImage.width}
                    height={coverImage.height}
                    sizes="(min-width: 1024px) 368px, (min-width: 700px) 48vw, 100vw"
                    className="public-news__card-image"
                  />
                  {post.images.length > 1 && (
                    <span className="public-news__photo-count">
                      <Images aria-hidden="true" size={14} />
                      {post.images.length} Photos
                    </span>
                  )}
                </button>

                <div className="public-news__card-body">
                  <div className="public-news__meta">
                    <span className="public-news__badge">{post.category}</span>
                    <span className="public-news__date">
                      <Calendar aria-hidden="true" size={14} />
                      {post.publishedAt}
                    </span>
                  </div>

                  <h3 className="public-news__card-title">{post.title}</h3>
                  <p className="public-news__card-excerpt">{post.content}</p>

                  <div className="public-news__card-footer">
                    <button
                      type="button"
                      className="public-news__read-btn"
                      onClick={() => openPost(post)}
                    >
                      Read announcement{" "}
                      <ArrowRight aria-hidden="true" size={16} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {selectedPost && activeImage && (
        <div
          className="public-news__lightbox"
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          onClick={(event) => {
            if (event.target === event.currentTarget) closePost();
          }}
        >
          <div className="public-news__modal">
            <div className="public-news__lightbox-header">
              <div>
                <div className="public-news__meta">
                  <span className="public-news__badge">
                    {selectedPost.category}
                  </span>
                  <span className="public-news__date">
                    <Calendar aria-hidden="true" size={14} />
                    {selectedPost.publishedAt}
                  </span>
                </div>
                <h3 id={dialogTitleId} className="public-news__modal-title">
                  {selectedPost.title}
                </h3>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close announcement"
                onClick={closePost}
                className="public-news__lightbox-close"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </div>

            <div className="public-news__modal-body">
              <div className="public-news__modal-media">
                <div className="public-news__modal-stage">
                  <Image
                    src={activeImage.src}
                    alt={activeImage.alt}
                    width={activeImage.width}
                    height={activeImage.height}
                    sizes="(min-width: 900px) 520px, 90vw"
                    loading="eager"
                    className="public-news__modal-image"
                  />
                  {selectedPost.images.length > 1 && (
                    <>
                      <button
                        type="button"
                        aria-label="Previous photo"
                        className="public-news__modal-nav public-news__modal-nav--prev"
                        onClick={() =>
                          setActiveImageIndex(
                            (activeImageIndex -
                              1 +
                              selectedPost.images.length) %
                              selectedPost.images.length,
                          )
                        }
                      >
                        <ArrowLeft aria-hidden="true" size={18} />
                      </button>
                      <button
                        type="button"
                        aria-label="Next photo"
                        className="public-news__modal-nav public-news__modal-nav--next"
                        onClick={() =>
                          setActiveImageIndex(
                            (activeImageIndex + 1) %
                              selectedPost.images.length,
                          )
                        }
                      >
                        <ArrowRight aria-hidden="true" size={18} />
                      </button>
                    </>
                  )}
                </div>

                {selectedPost.images.length > 1 && (
                  <div
                    className="public-news__modal-thumbs"
                    role="group"
                    aria-label="Announcement photos"
                  >
                    {selectedPost.images.map((img, index) => (
                      <button
                        key={img.src}
                        type="button"
                        aria-label={`View photo ${index + 1} of ${selectedPost.images.length}`}
                        aria-pressed={activeImageIndex === index}
                        onClick={() => setActiveImageIndex(index)}
                        className="public-news__modal-thumb"
                      >
                        <Image
                          src={img.src}
                          alt=""
                          width={72}
                          height={96}
                          loading="eager"
                          className="public-news__modal-thumb-img"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="public-news__modal-copy">
                <p className="public-news__modal-text">
                  {selectedPost.content}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
