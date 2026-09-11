import { useAuth } from "../contexts/AuthContext";

export default function Dashboard() {
  const { logout } = useAuth();

  return (
    <div style={{ padding: "24px" }}>
      <h1>Dashboard FarmaUBS</h1>
      <button
        type="button"
        onClick={() => logout()}
        style={{ padding: "8px 16px", marginTop: "16px" }}
      >
        Sair
      </button>
    </div>
  );
}
