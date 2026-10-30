"use client";
import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function MediaRail({ title, children }: { title: string; children: ReactNode }) {
  const rail = useRef<HTMLDivElement>(null);
  const move = (direction: number) => rail.current?.scrollBy({ left: direction * Math.max(480, rail.current.clientWidth * .78), behavior: "smooth" });
  return <><div className="media-shelf-arrows"><button type="button" aria-label={`Scroll ${title} left`} onClick={() => move(-1)}><ChevronLeft size={17}/></button><button type="button" aria-label={`Scroll ${title} right`} onClick={() => move(1)}><ChevronRight size={17}/></button></div><div ref={rail} className="scrollbar-hide flex gap-4 overflow-x-auto px-4 pb-4 sm:px-6">{children}</div></>;
}
