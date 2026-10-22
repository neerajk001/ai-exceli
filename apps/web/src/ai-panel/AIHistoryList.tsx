import { MODE_BY_ID } from "./aiModes";
import { useAIWorkspace } from "./AIWorkspaceContext";
import { ChevronDownIcon, HistoryIcon } from "./icons";

type AIHistoryListProps = {
  variant?: "panel" | "rail";
};

export function AIHistoryList({ variant = "panel" }: AIHistoryListProps) {
  const { history, activeEntryId, selectHistory } = useAIWorkspace();
  const limit = variant === "rail" ? 6 : 5;
  const visible = history.slice(0, limit);

  return (
    <details className={`bw-history bw-history-${variant}`}>
      <summary className="bw-history-heading">
        <HistoryIcon size={14} />
        <h3>History</h3>
        <span className="bw-history-count">{history.length}</span>
        <span className="bw-history-chevron">
          <ChevronDownIcon size={13} />
        </span>
      </summary>
      {visible.length === 0 ? (
        <p className="bw-history-empty">Your AI runs will appear here.</p>
      ) : (
        <div className="bw-history-list">
          {visible.map((entry) => {
            const meta = MODE_BY_ID[entry.mode];
            const active = entry.id === activeEntryId;

            return (
              <button
                key={entry.id}
                type="button"
                className="bw-history-item"
                aria-current={active ? "true" : undefined}
                onClick={() => selectHistory(entry)}
              >
                <span className="bw-history-icon">
                  <meta.icon size={14} />
                </span>
                <span className="bw-history-copy">
                  <strong>{entry.prompt}</strong>
                  <span>
                    {meta.label} ·{" "}
                    {new Date(entry.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
                <span className={`bw-history-dot bw-history-${entry.status}`} />
              </button>
            );
          })}
        </div>
      )}
    </details>
  );
}
