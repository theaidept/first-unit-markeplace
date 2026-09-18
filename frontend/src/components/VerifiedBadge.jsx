import { Check } from "lucide-react";

export const VerifiedBadge = ({ label = "Verified", ...props }) => (
  <span className="badge-verified" data-testid="verified-badge" {...props}>
    <Check strokeWidth={3} />
    {label}
  </span>
);
