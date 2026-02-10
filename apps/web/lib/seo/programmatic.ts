/**
 * Programmatic SEO landing pages. Used for generateStaticParams, sitemap, and page content.
 */

export type ProgrammaticPage = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  benefits: string[];
  faqs?: Array<{ question: string; answer: string }>;
};

export const PROGRAMMATIC_PAGES: ProgrammaticPage[] = [
  {
    slug: "free-calorie-tracker",
    title: "Free Calorie Tracker",
    description: "Track daily calories with no paywalls. AvoVibe is a free calorie tracker for web and mobile.",
    h1: "Free Calorie Tracker",
    benefits: [
      "No subscriptions or paywalls",
      "Track calories and macros in one place",
      "Works on web, iOS, and Android",
      "Private and simple",
      "Log meals and see daily totals",
    ],
    faqs: [
      { question: "Is AvoVibe really free?", answer: "Yes. AvoVibe has no premium tier or paywalls for core tracking." },
      { question: "Can I track macros too?", answer: "Yes. Track protein, carbs, fat, and fiber alongside calories." },
    ],
  },
  {
    slug: "macro-tracker-app",
    title: "Macro Tracker App",
    description: "Free macro tracker app. Log protein, carbs, fat, and fiber with no paywalls.",
    h1: "Macro Tracker App",
    benefits: [
      "Track protein, carbs, fat, and fiber",
      "Set daily targets and see progress",
      "Free with no premium lock-in",
      "Sync across devices",
    ],
  },
  {
    slug: "track-protein",
    title: "Track Protein Daily",
    description: "Hit your protein goals with a simple daily protein tracker. Free and no sign-up required to try.",
    h1: "Track Protein Daily",
    benefits: [
      "Daily protein total and target",
      "Log food and see protein per meal",
      "No paywalls",
      "Works on web and mobile",
    ],
  },
  {
    slug: "track-fiber",
    title: "Track Fiber Intake",
    description: "Track fiber intake daily with AvoVibe. Free fiber tracker for better nutrition habits.",
    h1: "Track Fiber Intake",
    benefits: [
      "Log fiber from meals and snacks",
      "See daily fiber total vs goal",
      "Part of full macro and calorie tracking",
      "Free to use",
    ],
  },
  {
    slug: "track-water",
    title: "Track Water Intake",
    description: "Stay hydrated with a simple water tracker. Log glasses or ml and hit your daily goal.",
    h1: "Track Water Intake",
    benefits: [
      "Set a daily water goal",
      "Quick-add common amounts",
      "Works with calories and macros in one app",
      "Free",
    ],
  },
  {
    slug: "calorie-tracker-canada",
    title: "Calorie Tracker Canada",
    description: "Free calorie and macro tracker for Canadians. No paywalls, works in English and French.",
    h1: "Calorie Tracker for Canada",
    benefits: [
      "Built for Canadian users",
      "English and French",
      "Metric and imperial options",
      "No subscriptions",
    ],
  },
  {
    slug: "calorie-counter-free",
    title: "Free Calorie Counter",
    description: "Count calories for free with AvoVibe. No premium features locked away.",
    h1: "Free Calorie Counter",
    benefits: [
      "Unlimited logging",
      "Food search and custom foods",
      "Daily and weekly views",
      "Completely free",
    ],
  },
  {
    slug: "food-diary-app",
    title: "Food Diary App",
    description: "Simple food diary app to log meals and track nutrition. Free calorie and macro diary.",
    h1: "Food Diary App",
    benefits: [
      "Log meals by type (breakfast, lunch, dinner, snacks)",
      "See calories and macros per day",
      "No paywalls",
      "Web and mobile",
    ],
  },
  {
    slug: "macro-calculator",
    title: "Macro Calculator",
    description: "Understand your macro needs. AvoVibe helps you set calorie and macro targets based on your goals.",
    h1: "Macro Calculator & Targets",
    benefits: [
      "Set calorie and macro targets",
      "Adjust for weight and activity",
      "Track against your targets daily",
      "Free",
    ],
  },
  {
    slug: "weight-tracker",
    title: "Weight Tracker",
    description: "Track weight over time with AvoVibe. Log weight and see trends alongside calories and macros.",
    h1: "Weight Tracker",
    benefits: [
      "Log weight daily or when you choose",
      "View trends over time",
      "One app for weight, calories, and macros",
      "Free",
    ],
  },
];

export function getProgrammaticPage(slug: string): ProgrammaticPage | undefined {
  return PROGRAMMATIC_PAGES.find((p) => p.slug === slug);
}
