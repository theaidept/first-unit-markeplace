import { Link } from "react-router-dom";
import logo from "../assets/logo.png";

export function Footer() {
  return (
    <footer className="mega-footer" data-testid="mega-footer">
      <div className="wrap mf-top">
        <div className="mf-brand">
          <Link to="/" className="mf-logo" data-testid="footer-logo"><img src={logo} alt="First Unit USA" /></Link>
          <p>Verified marketplace for first responders</p>
        </div>
        <div className="mf-cols">
          <div>
            <h4>Marketplace</h4>
            <Link to="/marketplace">Browse all</Link>
            <Link to="/sell">Sell an item</Link>
            <Link to="/marketplace?cat=video">Video listings</Link>
            <Link to="/marketplace?cat=deals">Deals</Link>
          </div>
          <div>
            <h4>Community</h4>
            <Link to="/members">Members</Link>
            <Link to="/dashboard?view=jobs">Job Board</Link>
            <Link to="/messages">Messages</Link>
          </div>
          <div>
            <h4>Account</h4>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/profile">Profile</Link>
            <Link to="/verification">Verification</Link>
            <Link to="/transactions">Orders &amp; Offers</Link>
          </div>
          <div>
            <h4>Company</h4>
            <Link to="/">About First Unit</Link>
            <a href="mailto:support@firstunit.us">Help &amp; Support</a>
            <Link to="/">Trust &amp; Safety</Link>
          </div>
        </div>
      </div>
      <div className="mf-legal-bar">
        <div className="wrap mf-legal">© {new Date().getFullYear()} First Unit — Verified first responders only.</div>
      </div>
    </footer>
  );
}
