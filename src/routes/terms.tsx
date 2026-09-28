import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Όροι χρήσης — Courtsie" },
      { name: "description", content: "Οι όροι χρήσης της πλατφόρμας Courtsie." },
    ],
  }),
  component: () => (
    <LegalPage
      titleKey="legal.terms.title"
      updatedKey="legal.terms.updated"
      introKey="legal.terms.intro"
      sectionsKey="legal.terms.sections"
      headingClassName="text-foreground dark:text-foreground"
    />
  ),
});
