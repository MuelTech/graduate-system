import { publicSiteContent } from "@/content/public-site-content";

export function DesignPreviewNotice() {
  return (
    <div className="public-review-notice">
      <p className="public-review-notice__text">
        {publicSiteContent.previewNotice}
      </p>
    </div>
  );
}
