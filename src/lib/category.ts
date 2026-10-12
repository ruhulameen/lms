// Accent colours per course / article category, as used in the design.
const CATEGORY_STYLES: Record<string, { text: string; solid: string }> = {
  "Career Advice": { text: "text-blue-600", solid: "bg-blue-600" },
  Career: { text: "text-blue-600", solid: "bg-blue-600" },
  Healthcare: { text: "text-green-600", solid: "bg-green-600" },
  "Health & Social Care": { text: "text-green-600", solid: "bg-green-600" },
  "IT & Computing": { text: "text-purple-600", solid: "bg-purple-600" },
  "Health & Safety": { text: "text-orange-600", solid: "bg-orange-600" },
  Construction: { text: "text-red-600", solid: "bg-red-600" },
  Business: { text: "text-teal-600", solid: "bg-teal-600" },
  Teaching: { text: "text-orange-600", solid: "bg-orange-600" },
  Language: { text: "text-blue-600", solid: "bg-blue-600" },
};

const FALLBACK = { text: "text-blue-600", solid: "bg-blue-600" };

export function categoryStyle(category: string) {
  return CATEGORY_STYLES[category] ?? FALLBACK;
}
