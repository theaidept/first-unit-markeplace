import { Link } from "react-router-dom";

export const Brand = ({ to = "/", light = false }) => (
  <Link to={to} className="brand" data-testid="brand-logo">
    <span className="brand-mark" />
    <span className="brand-word" style={light ? { color: "#fff" } : undefined}>
      First Unit
    </span>
  </Link>
);
