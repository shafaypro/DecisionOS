import { LegalPage, LegalSection } from "@/components/legal/legal-page";
import { Text } from "@/components/ui/text";

export const metadata = {
  title: "Privacy Policy | DecisionOS",
  description: "How DecisionOS collects, uses, and protects your personal data.",
};

const P = ({ children }: { children: React.ReactNode }) => (
  <Text as="p" color="secondary">{children}</Text>
);

const Item = ({ children }: { children: React.ReactNode }) => (
  <li className="ml-5 list-disc"><Text as="span" color="secondary">{children}</Text></li>
);

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="1 July 2026">
      <P>
        This policy explains what personal data DecisionOS collects, why, and the rights you have
        over it. It is written to align with the EU General Data Protection Regulation (GDPR).
        This is a starting template and should be reviewed by your legal counsel before you rely
        on it for a production service.
      </P>

      <LegalSection heading="Who we are">
        <P>
          DecisionOS is a decision-logging tool for teams. For data you put into the product, your
          organisation (the workspace) is the data controller and DecisionOS acts as a processor on
          its behalf. For account-level data we describe below, DecisionOS is the controller.
        </P>
      </LegalSection>

      <LegalSection heading="Data we collect">
        <ul className="space-y-1">
          <Item><strong>Account data:</strong> your name, email address, and a securely hashed password.</Item>
          <Item><strong>Content you create:</strong> decisions, rationale, notes, reviews, links, tags, and related records.</Item>
          <Item><strong>Workspace data:</strong> membership and role within a workspace.</Item>
          <Item><strong>Operational data:</strong> first-party product events (for example, a decision was created or reviewed) and server logs. IP addresses are used transiently for rate limiting.</Item>
          <Item><strong>Security audit trail:</strong> to keep the service secure and meet our compliance obligations, we record security-relevant actions - such as sign-ins, membership changes, and data exports - together with the acting user, their IP address, and the time. Credentials are never recorded.</Item>
        </ul>
        <P>We do not use third-party advertising or tracking cookies.</P>
      </LegalSection>

      <LegalSection heading="How we use data and our lawful basis">
        <ul className="space-y-1">
          <Item>To provide the service you signed up for (performance of a contract).</Item>
          <Item>To secure the service, prevent abuse, and keep audit and security logs (legitimate interests).</Item>
          <Item>To comply with legal obligations where they apply.</Item>
        </ul>
      </LegalSection>

      <LegalSection heading="Sub-processors">
        <P>We rely on a small set of providers to run the service:</P>
        <ul className="space-y-1">
          <Item><strong>Your hosting provider:</strong> DecisionOS is self-hosted, so infrastructure (server, database) is operated by whoever runs your instance.</Item>
          <Item><strong>Optional, only if your workspace enables them:</strong> an email provider for notifications, Slack for capture, and an error-monitoring service.</Item>
        </ul>
      </LegalSection>

      <LegalSection heading="Where your data is stored">
        <P>
          DecisionOS is self-hosted, so your data lives wherever the operator of your instance
          runs it and its database. The operator chooses the region and is responsible for any
          cross-border transfer safeguards (such as Standard Contractual Clauses) that apply.
        </P>
      </LegalSection>

      <LegalSection heading="How long we keep it">
        <P>
          We keep your data for as long as your account or workspace is active. When you delete your
          account or a workspace, the associated personal data is removed. Operational logs are kept
          for a limited retention window and then expire.
        </P>
        <P>
          Security audit records are retained separately for a limited period so that a deletion or
          other security-relevant action stays provable, and are then pruned on a schedule.
        </P>
      </LegalSection>

      <LegalSection heading="Your rights">
        <P>Under the GDPR you can, at any time:</P>
        <ul className="space-y-1">
          <Item><strong>Access and export:</strong> download a machine-readable copy of your data from Settings.</Item>
          <Item><strong>Erasure:</strong> delete your account, or (as an admin) delete a workspace, from Settings. Deletion is permanent.</Item>
          <Item><strong>Rectification:</strong> correct your name, email, and workspace details in the app.</Item>
          <Item><strong>Object or restrict:</strong> contact us to object to or restrict certain processing.</Item>
        </ul>
      </LegalSection>

      <LegalSection heading="Cookies">
        <P>
          DecisionOS uses a single strictly-necessary cookie to keep you signed in. It is encrypted,
          HttpOnly, and not used for advertising or cross-site tracking. Because it is essential to
          the service, it does not require opt-in consent, but it is disclosed here for transparency.
        </P>
      </LegalSection>

      <LegalSection heading="Security">
        <P>
          Session cookies and stored credentials (such as integration and single-sign-on secrets) are
          encrypted with AES-256-GCM. Passwords are hashed with bcrypt. Access to workspace data is
          scoped per tenant and per role. We keep a tamper-evident audit trail of security-relevant
          events, which workspace administrators can review in Settings.
        </P>
      </LegalSection>

      <LegalSection heading="Contact">
        <P>
          For privacy questions or to exercise a right that is not self-serve in the app, contact the
          workspace owner or the operator of this DecisionOS instance.
        </P>
      </LegalSection>
    </LegalPage>
  );
}
