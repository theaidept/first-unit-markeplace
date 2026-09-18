import { Link } from "react-router-dom";
import logo from "../assets/logo.png";

export const Brand = ({ to = "/" }) => (
  <Link to={to} className="brand" data-testid="brand-logo" aria-label="First Unit USA">
    <img src={logo} alt="First Unit USA" className="brand-logo-img" />
  </Link>
);
