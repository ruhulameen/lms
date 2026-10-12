import type { Metadata } from "next";

// The course player has no site header or footer: the player draws its own bar.
// It is for learners, so search engines are told to leave it alone.
export const metadata: Metadata = {
  title: "Course player",
  robots: { index: false, follow: false },
};

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return children;
}
