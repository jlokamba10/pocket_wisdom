import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="page center">
      <h1>Page not found</h1>
      <p>The page you requested does not exist.</p>
      <Link className="link" to="/app">
        Return to workspace
      </Link>
    </div>
  );
}
