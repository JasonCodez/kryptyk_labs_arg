import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

/**
 * Shared page-width tiers — start narrow, add only as a real route adopts one.
 * Class strings below intentionally match the homepage's existing ad hoc
 * widths exactly, so adopting this component changes no geometry.
 */
export type PageContainerSize = "reading" | "content";

/** Semantic elements the homepage needs; extend only when a real caller needs one. */
export type PageContainerElement = "div" | "section" | "footer";

const SIZE_CLASSES: Record<PageContainerSize, string> = {
  reading: "px-4 lg:max-w-2xl lg:mx-auto",
  content: "px-4 lg:max-w-4xl lg:mx-auto",
};

type PageContainerOwnProps<E extends PageContainerElement> = {
  as?: E;
  size?: PageContainerSize;
  children?: ReactNode;
};

export type PageContainerProps<E extends PageContainerElement = "div"> = PageContainerOwnProps<E> &
  Omit<ComponentPropsWithoutRef<E>, keyof PageContainerOwnProps<E>>;

/**
 * A pure presentational page-width wrapper — no client-only APIs, so it
 * renders identically on the server. Centralizes the responsive horizontal
 * gutter + centered max-width pattern that routes previously repeated ad hoc.
 */
export default function PageContainer<E extends PageContainerElement = "div">({
  as,
  size = "content",
  className,
  children,
  ...rest
}: PageContainerProps<E>) {
  const Component = (as ?? "div") as ElementType;
  const classes = className ? `${SIZE_CLASSES[size]} ${className}` : SIZE_CLASSES[size];

  return (
    <Component className={classes} {...rest}>
      {children}
    </Component>
  );
}
