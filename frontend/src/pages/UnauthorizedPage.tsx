import { Link } from "react-router-dom";

export default function UnauthorizedPage() {
  return (
    <div className="page center">
      <h1>Unauthorized</h1>
      <p>You do not have access to this section.</p>
      <Link className="link" to="/app">
        Return to workspace
      </Link>
    </div>
  );
}
