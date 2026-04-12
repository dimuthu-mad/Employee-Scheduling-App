import { Link } from "react-router-dom";

export function UnauthorizedPage() {
  return (
    <main style={{ maxWidth: 700, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Unauthorized</h1>
      <p>You do not have permission to view this page.</p>
      <p>
        <Link to="/login">Back to login</Link>
      </p>
    </main>
  );
}
