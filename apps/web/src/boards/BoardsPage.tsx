import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  createBoard,
  deleteBoard,
  listBoards,
  updateBoard,
  type BoardSummary,
} from "../api-client/client";
import { useAuth } from "../auth/AuthContext";

export function BoardsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setBoards(await listBoards());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not load boards.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();

    if (!title.trim() || creating) {
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const board = await createBoard(title.trim());

      navigate(`/board/${board.id}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not create the board.",
      );
      setCreating(false);
    }
  };

  const startRename = (board: BoardSummary) => {
    setEditingId(board.id);
    setEditingTitle(board.title);
  };

  const commitRename = async (board: BoardSummary) => {
    const nextTitle = editingTitle.trim();
    setEditingId(null);

    if (!nextTitle || nextTitle === board.title) {
      return;
    }

    try {
      await updateBoard(board.id, { title: nextTitle });
      setBoards((previous) =>
        previous.map((candidate) =>
          candidate.id === board.id
            ? { ...candidate, title: nextTitle }
            : candidate,
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not rename the board.",
      );
    }
  };

  const handleDelete = async (board: BoardSummary) => {
    if (!window.confirm(`Delete "${board.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteBoard(board.id);
      setBoards((previous) =>
        previous.filter((candidate) => candidate.id !== board.id),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not delete the board.",
      );
    }
  };

  return (
    <main className="page page-wide">
      <header className="page-header">
        <div>
          <h1 className="page-title">Your boards</h1>
          <p className="page-muted">{user?.email}</p>
        </div>
        <button
          type="button"
          className="page-button"
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </header>

      <form className="board-create" onSubmit={handleCreate}>
        <input
          className="auth-input"
          placeholder="New board title"
          value={title}
          maxLength={120}
          disabled={creating}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button
          className="auth-submit"
          type="submit"
          disabled={creating || !title.trim()}
        >
          {creating ? "Creating..." : "Create board"}
        </button>
      </form>

      {error ? (
        <div className="page-error-row">
          <p className="page-error">{error}</p>
          <button
            type="button"
            className="page-button"
            onClick={() => void refresh()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className="page-muted">Loading boards...</p>
      ) : boards.length === 0 ? (
        <div className="board-empty">
          <p>No boards yet.</p>
          <p className="page-muted">
            Create your first board above to start drawing.
          </p>
        </div>
      ) : (
        <ul className="board-list">
          {boards.map((board) => (
            <li key={board.id} className="board-item">
              {editingId === board.id ? (
                <input
                  className="auth-input"
                  value={editingTitle}
                  maxLength={120}
                  autoFocus
                  onChange={(event) => setEditingTitle(event.target.value)}
                  onBlur={() => void commitRename(board)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                    if (event.key === "Escape") {
                      setEditingId(null);
                    }
                  }}
                />
              ) : (
                <Link className="board-open" to={`/board/${board.id}`}>
                  <span className="board-name">{board.title}</span>
                  <span className="board-date">
                    Updated {new Date(board.updatedAt).toLocaleString()}
                  </span>
                </Link>
              )}

              <div className="board-actions">
                <button
                  type="button"
                  className="page-button"
                  onClick={() => startRename(board)}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="page-button page-button-danger"
                  onClick={() => void handleDelete(board)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
