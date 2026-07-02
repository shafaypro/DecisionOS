import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { Text } from "@/components/ui/text";

export const metadata = {
  title: "Terms of Service | DecisionOS",
  description: "The terms that govern your use of DecisionOS.",
};

const P = ({ children }: { children: React.ReactNode }) => (
  <Text as="p" color="secondary">{children}</Text>
);

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="30 June 2026">
      <P>
        These terms govern your use of DecisionOS. This is a starting template and should be
        reviewed by your legal counsel before you rely on it for a production service.
      </P>

      <LegalSection heading="Your account">
        <P>
          You are responsible for the activity under your account and for keeping your credentials
          secure. You must provide accurate information and be authorised to act for your workspace.
        </P>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <P>
          Do not use the service to break the law, infringe others rights, attempt to access data
          that is not yours, or disrupt the service. We may suspend access that puts the service or
          other customers at risk.
        </P>
      </LegalSection>

      <LegalSection heading="Cost and licensing">
        <P>
          DecisionOS is free and open source under the MIT License. There are no paid plans,
          seats, or subscriptions. You may self-host it and use it for any purpose permitted by
          the license; if you are using a hosted instance, its operator sets any additional terms.
        </P>
      </LegalSection>

      <LegalSection heading="Your content">
        <P>
          You keep ownership of the decisions and content you put into DecisionOS. You grant us only
          the limited rights needed to host and operate the service for you. You can export your
          data and delete your account or workspace at any time from Settings.
        </P>
      </LegalSection>

      <LegalSection heading="Availability and disclaimer">
        <P>
          The service is provided on an as-is and as-available basis. We work to keep it running but
          do not guarantee uninterrupted or error-free operation. Keep your own backups of anything
          critical via the export feature.
        </P>
      </LegalSection>

      <LegalSection heading="Limitation of liability">
        <P>
          To the extent permitted by law, DecisionOS is not liable for indirect or consequential
          loss, and total liability is limited to the amounts you paid for the service in the prior
          twelve months.
        </P>
      </LegalSection>

      <LegalSection heading="Termination">
        <P>
          You may stop using the service at any time and delete your account or workspace. We may
          suspend or end access for material breach of these terms.
        </P>
      </LegalSection>

      <LegalSection heading="Changes and contact">
        <P>
          We may update these terms; material changes will be reflected by the date above. For
          questions, contact the operator of this DecisionOS instance.
        </P>
      </LegalSection>
    </LegalPage>
  );
}
