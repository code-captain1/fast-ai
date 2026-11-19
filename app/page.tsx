import CoolBtn from "@/components/CoolBtn";
import ResponsiveHeroBanner from "@/components/ui/responsive-hero-banner";
import TestimonialGlobeDemo from "@/components/Testimonials";

export default function Home() {
  return (
    <main className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans text-gray-900">
      <ResponsiveHeroBanner
        title="Make Content Fast Today"
        titleLine2="Into the Cosmos"
        description="Get the Top AI Models"
        primaryButtonText="Get Started"
        secondaryButtonText="Learn More"
      />
      <TestimonialGlobeDemo></TestimonialGlobeDemo>
      
    </main>
  );
}
