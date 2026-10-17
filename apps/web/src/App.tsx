import { PROJECT_NAME, PROJECT_VERSION } from "@wb/shared-types";

export function App() {
  return (
    <main className="app">
      <h1>{PROJECT_NAME}</h1>
      <p>
        Monorepo shell v{PROJECT_VERSION} — this value was imported from{" "}
        <code>@wb/shared-types</code>.
      </p>
    </main>
  );
}
