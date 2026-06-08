import { createFileRoute } from "@tanstack/react-router";
import { LivingOrganism } from "@/components/LivingOrganism";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Living Website — An organism that grows" },
      { name: "description", content: "A website that behaves like a living organism. Pages grow, sections mutate, elements reproduce." },
      { property: "og:title", content: "Living Website" },
      { property: "og:description", content: "A website that grows, mutates, and reproduces." },
    ],
  }),
  component: Index,
});

function Index() {
  return <LivingOrganism />;
}
