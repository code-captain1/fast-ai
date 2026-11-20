"use client";

import { SignInPage, type Testimonial } from "@/components/ui/sign-in";

// Sample content: replace with real user quotes before launch
const testimonials: Testimonial[] = [
  {
    avatarSrc: "https://randomuser.me/api/portraits/women/57.jpg",
    name: "Sarah Chen",
    handle: "@sarahdigital",
    text: "I type a sentence and get audio back in seconds. It saves me hours every week.",
  },
  {
    avatarSrc: "https://randomuser.me/api/portraits/men/64.jpg",
    name: "Marcus Johnson",
    handle: "@marcustech",
    text: "Having every chat and voice clip saved in one place is the part I didn't know I needed.",
  },
  {
    avatarSrc: "https://randomuser.me/api/portraits/men/32.jpg",
    name: "David Martinez",
    handle: "@davidcreates",
    text: "Clean, fast and simple. It went from a side experiment to my daily tool.",
  },
];

export default function SignInClient() {
  return (
    <SignInPage
      description="Sign in or create an account to continue"
      heroImageSrc="https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80"
      testimonials={testimonials}
    />
  );
}