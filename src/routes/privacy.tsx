import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Πολιτική Απορρήτου — Speak" },
      {
        name: "description",
        content: "Πώς το Speak συλλέγει, χρησιμοποιεί και προστατεύει τα προσωπικά σου δεδομένα.",
      },
    ],
  }),
  component: () => (
    <LegalPage
      titleKey="legal.privacy.title"
      updatedKey="legal.privacy.updated"
      introKey="legal.privacy.intro"
      sectionsKey="legal.privacy.sections"
      headingClassName="text-foreground dark:text-foreground"
    />
  ),
});
