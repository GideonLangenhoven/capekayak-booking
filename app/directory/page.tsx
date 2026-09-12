import OperatorDirectory from "../components/OperatorDirectory";

// Explicit route for the operator directory — the same component also renders
// on the home page when the request host resolves to no tenant (bare domain).
export default function DirectoryPage() {
  return <OperatorDirectory />;
}
