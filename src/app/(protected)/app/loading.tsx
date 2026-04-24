export default function AppLoading() {
  return (
    <main
      aria-live="polite"
      aria-busy="true"
      style={{
        minHeight: "calc(100vh - 98px)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 12,
          justifyItems: "center",
          color: "var(--mantine-color-gray-6)",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            border: "3px solid var(--mantine-color-gray-2)",
            borderTopColor: "var(--mantine-color-cyan-6)",
            borderRadius: "50%",
            animation: "encaja-loading-spin 0.8s linear infinite",
          }}
        />
        <span style={{ fontSize: 14 }}>Cargando...</span>
      </div>
    </main>
  );
}
