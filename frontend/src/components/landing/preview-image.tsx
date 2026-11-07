import Image from "next/image";

interface PreviewImageProps {
  image: {
    src: string;
    width: number;
    height: number;
    alt: string;
    caption: string;
  };
  className?: string;
  sizes: string;
  priority?: boolean;
}

export function PreviewImage({
  image,
  className = "",
  sizes,
  priority = false,
}: PreviewImageProps) {
  return (
    <figure className={`public-preview-image ${className}`}>
      <div className="public-preview-image__frame">
        <Image
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          sizes={sizes}
          priority={priority}
          className="public-preview-image__image"
        />
      </div>
      <figcaption className="public-preview-image__caption">
        {image.caption}
      </figcaption>
    </figure>
  );
}
