import ResponsiveHeroBanner from "@/components/ui/responsive-hero-banner";
import TestimonialGlobeDemo from "@/components/Testimonials";
import AnimatedHeroDemo from "@/components/new";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata = {
  alternates: { canonical: "/" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "KineticClips AI",
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web",
  description:
    "AI assistant for chat, writing, coding help and text-to-speech.",
  url: siteUrl,
};

export default function Home() {
  return (
    <main className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans text-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <ResponsiveHeroBanner
        title="Make Content Fast Today"
        titleLine2="Into the Cosmos"
        description="Get the Top AI Models"
        primaryButtonText="Get Started"
        secondaryButtonText="Learn More"
      />
      <TestimonialGlobeDemo />
      <AnimatedHeroDemo />
    </main>
  );
}