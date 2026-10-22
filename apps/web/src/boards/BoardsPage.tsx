import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  createBoard,
  deleteBoard,
  listBoards,
  updateBoard,
  type BoardSummary,
} from "../api-client/client";
import { useAuth } from "../auth/AuthContext";
import "./workspace.css";

const RECENT_LIMIT = 3;

function ArrowRight({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="16" fill="#17161a" />
      <path
        d="M10.5 12.4c0-1.3 1-2.4 2.3-2.4h6.4c1.3 0 2.3 1.1 2.3 2.4s-1 2.4-2.3 2.4h-6.4v5.1c0 1.3 1 2.4 2.3 2.4h2.4c1.3 0 2.3-1.1 2.3-2.4"
        stroke="#f7f3e9"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BoardIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}

function Sparkle({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2.5c.6 3.9 2.1 5.4 6 6-3.9.6-5.4 2.1-6 6-.6-3.9-2.1-5.4-6-6 3.9-.6 5.4-2.1 6-6Z" />
      <path d="M19 14c.3 2 1 2.7 3 3-2 .3-2.7 1-3 3-.3-2-1-2.7-3-3 2-.3 2.7-1 3-3Z" />
      <path d="M5.5 15c.25 1.6.9 2.25 2.5 2.5-1.6.25-2.25.9-2.5 2.5-.25-1.6-.9-2.25-2.5-2.5 1.6-.25 2.25-.9 2.5-2.5Z" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m4 20 4-1L19.5 7.5a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" />
      <path d="m14.5 6.5 3 3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function KebabIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="12" height="12" rx="2.5" />
      <path d="M9 21h9a3 3 0 0 0 3-3V9" />
    </svg>
  );
}

function DoodleSparks({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 38 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4 28 11 18M17 26l3-11M30 29l-4-10"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HeroArt() {
  return (
    <div className="workspace-hero-art" aria-hidden="true">
      <svg className="workspace-art-sparks" viewBox="0 0 34 30" fill="none">
        <path
          d="M4 26 10 17M17 24l3-10M30 27l-4-9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <div className="workspace-art-card workspace-art-lav">
        <span>
          Ideas
          <br />
          Diagrams
          <br />
          Answers
          <br />
          Code
        </span>
      </div>
      <svg className="workspace-art-arrow" viewBox="0 0 100 90" fill="none">
        <path
          d="M8 14c34 2 56 18 64 54m0 0-11-5m11 5 3-11"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="workspace-art-card workspace-art-pink">
        <span>
          All in
          <br />
          one place
        </span>
        <span className="workspace-art-underline" />
      </div>
      <svg className="workspace-art-spark" viewBox="0 0 40 34" fill="none">
        <path
          d="M5 30 12 20M23 27V16M34 32l-5-9"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

type NodeProps = {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  stroke: string;
  label: string;
};

function PreviewNode({ x, y, w, h, fill, stroke, label }: NodeProps) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="5"
        fill={fill}
        stroke={stroke}
        strokeWidth="1"
      />
      <text
        x={x + w / 2}
        y={y + h / 2 + 3}
        textAnchor="middle"
        fontSize="8"
        fontWeight="500"
        fill="#3d3a44"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {label}
      </text>
    </g>
  );
}

function previewVariant(seed: string) {
  let value = 0;

  for (let index = 0; index < seed.length; index += 1) {
    value = (value * 31 + seed.charCodeAt(index)) % 997;
  }

  return value % 3;
}

function BoardPreview({ seed }: { seed: string }) {
  const variant = previewVariant(seed);
  const markerId = `preview-arrow-${seed.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const nodesByVariant: Record<number, NodeProps[]> = {
    0: [
      {
        x: 105,
        y: 8,
        w: 60,
        h: 22,
        fill: "#ece7ff",
        stroke: "#b9a7ee",
        label: "User",
      },
      {
        x: 95,
        y: 50,
        w: 80,
        h: 24,
        fill: "#e4edff",
        stroke: "#9dbcf1",
        label: "Login Screen",
      },
      {
        x: 32,
        y: 96,
        w: 80,
        h: 24,
        fill: "#fff2ca",
        stroke: "#e5ca75",
        label: "Auth Service",
      },
      {
        x: 172,
        y: 96,
        w: 96,
        h: 24,
        fill: "#e4edff",
        stroke: "#9dbcf1",
        label: "Session Manager",
      },
      {
        x: 40,
        y: 140,
        w: 76,
        h: 24,
        fill: "#ffe3ec",
        stroke: "#f0a9c2",
        label: "User Accounts",
      },
      {
        x: 185,
        y: 140,
        w: 84,
        h: 24,
        fill: "#dcf5e6",
        stroke: "#92d6ab",
        label: "Protected App",
      },
    ],
    1: [
      {
        x: 10,
        y: 70,
        w: 60,
        h: 24,
        fill: "#e4edff",
        stroke: "#9dbcf1",
        label: "Client",
      },
      {
        x: 100,
        y: 70,
        w: 70,
        h: 24,
        fill: "#ece7ff",
        stroke: "#b9a7ee",
        label: "API Gateway",
      },
      {
        x: 100,
        y: 20,
        w: 70,
        h: 22,
        fill: "#fff2ca",
        stroke: "#e5ca75",
        label: "Auth",
      },
      {
        x: 100,
        y: 130,
        w: 70,
        h: 22,
        fill: "#dcf5e6",
        stroke: "#92d6ab",
        label: "Orders",
      },
      {
        x: 210,
        y: 70,
        w: 70,
        h: 24,
        fill: "#ffe3ec",
        stroke: "#f0a9c2",
        label: "Database",
      },
    ],
    2: [
      {
        x: 100,
        y: 10,
        w: 70,
        h: 24,
        fill: "#ffe3ec",
        stroke: "#f0a9c2",
        label: "Idea",
      },
      {
        x: 20,
        y: 70,
        w: 70,
        h: 22,
        fill: "#fff2ca",
        stroke: "#e5ca75",
        label: "Research",
      },
      {
        x: 115,
        y: 70,
        w: 70,
        h: 22,
        fill: "#e4edff",
        stroke: "#9dbcf1",
        label: "Design",
      },
      {
        x: 210,
        y: 70,
        w: 70,
        h: 22,
        fill: "#dcf5e6",
        stroke: "#92d6ab",
        label: "Validate",
      },
      {
        x: 65,
        y: 130,
        w: 70,
        h: 22,
        fill: "#ece7ff",
        stroke: "#b9a7ee",
        label: "Build",
      },
      {
        x: 170,
        y: 130,
        w: 70,
        h: 22,
        fill: "#ffe3ec",
        stroke: "#f0a9c2",
        label: "Launch",
      },
    ],
  };

  const pathsByVariant: Record<number, string[]> = {
    0: [
      "M135 30v20",
      "M115 74 72 96",
      "M155 74 210 96",
      "M72 120v20",
      "M220 120l7 20",
    ],
    1: ["M70 82h30", "M170 82h40", "M135 70V42", "M135 94v36"],
    2: [
      "M120 34 55 70",
      "M135 34v36",
      "M150 34 245 70",
      "M55 92l45 38",
      "M150 92 135 130",
      "M245 92l-40 38",
    ],
  };

  return (
    <svg
      viewBox="0 0 300 180"
      className="workspace-preview-svg"
      role="img"
      aria-label="Diagram preview"
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto-start-reverse"
        >
          <path d="M0 0 10 5 0 10Z" fill="#9b97a6" />
        </marker>
      </defs>
      {(pathsByVariant[variant] ?? []).map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke="#9b97a6"
          strokeWidth="1"
          markerEnd={`url(#${markerId})`}
        />
      ))}
      {(nodesByVariant[variant] ?? []).map((node) => (
        <PreviewNode key={`${node.x}-${node.y}`} {...node} />
      ))}
    </svg>
  );
}

function TemplateThumb({ variant }: { variant: "flow" | "steps" | "mind" }) {
  return (
    <span className="workspace-template-thumb" aria-hidden="true">
      <svg viewBox="0 0 110 76" fill="none">
        {variant === "flow" ? (
          <>
            <path
              d="M22 20h14M58 20h14M22 58h14M58 58h14M29 26v26M51 26v26"
              stroke="#b7b2c8"
              strokeWidth="0.9"
            />
            <rect x="6" y="13" width="18" height="13" rx="3" fill="#e4edff" stroke="#9dbcf1" strokeWidth="0.8" />
            <rect x="36" y="13" width="22" height="13" rx="3" fill="#ece7ff" stroke="#b9a7ee" strokeWidth="0.8" />
            <rect x="72" y="13" width="18" height="13" rx="3" fill="#dcf5e6" stroke="#92d6ab" strokeWidth="0.8" />
            <rect x="14" y="51" width="24" height="13" rx="3" fill="#fff2ca" stroke="#e5ca75" strokeWidth="0.8" />
            <rect x="64" y="51" width="26" height="13" rx="3" fill="#ffe3ec" stroke="#f0a9c2" strokeWidth="0.8" />
          </>
        ) : null}
        {variant === "steps" ? (
          <>
            <path d="M20 20v36M20 38h8M20 53h8" stroke="#b7b2c8" strokeWidth="0.9" />
            <rect x="8" y="13" width="24" height="13" rx="3" fill="#fff2ca" stroke="#e5ca75" strokeWidth="0.8" />
            <rect x="34" y="28" width="38" height="13" rx="3" fill="#e4edff" stroke="#9dbcf1" strokeWidth="0.8" />
            <rect x="52" y="43" width="40" height="13" rx="3" fill="#ffe3ec" stroke="#f0a9c2" strokeWidth="0.8" />
            <rect x="72" y="58" width="30" height="12" rx="3" fill="#dcf5e6" stroke="#92d6ab" strokeWidth="0.8" />
          </>
        ) : null}
        {variant === "mind" ? (
          <>
            <path
              d="M55 38 25 20M55 38l30-18M55 38 25 58M55 38l30 20"
              stroke="#b7b2c8"
              strokeWidth="0.9"
            />
            <rect x="38" y="30" width="34" height="16" rx="3" fill="#ece7ff" stroke="#b9a7ee" strokeWidth="0.8" />
            <rect x="10" y="12" width="26" height="13" rx="3" fill="#e4edff" stroke="#9dbcf1" strokeWidth="0.8" />
            <rect x="74" y="12" width="26" height="13" rx="3" fill="#fff2ca" stroke="#e5ca75" strokeWidth="0.8" />
            <rect x="10" y="51" width="26" height="13" rx="3" fill="#ffe3ec" stroke="#f0a9c2" strokeWidth="0.8" />
            <rect x="74" y="51" width="26" height="13" rx="3" fill="#dcf5e6" stroke="#92d6ab" strokeWidth="0.8" />
          </>
        ) : null}
      </svg>
    </span>
  );
}

function formatUpdated(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

export function BoardsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const createInputRef = useRef<HTMLInputElement>(null);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);

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

  const focusCreate = () => {
    createInputRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    createInputRef.current?.focus();
  };

  const visibleBoards = showAll ? boards : boards.slice(0, RECENT_LIMIT);
  const initial = user?.email?.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="workspace">
      <header className="workspace-nav">
        <div className="workspace-container workspace-nav-inner">
          <Link to="/" className="workspace-brand" aria-label="TidyBoard home">
            <BrandMark />
            <span>TidyBoard</span>
          </Link>
          <nav className="workspace-nav-links" aria-label="Workspace navigation">
            <Link to="/boards" className="workspace-nav-active" aria-current="page">
              Boards
            </Link>
            <a href="#templates">Templates</a>
            <a href="#create-board">AI Hub</a>
            <a href="#recent">Examples</a>
            <a href="#templates">Community</a>
          </nav>
          <div className="workspace-nav-account">
            <span className="workspace-user">
              <span className="workspace-avatar">{initial}</span>
              <span className="workspace-email">{user?.email}</span>
              <span className="workspace-chevron">
                <ChevronDown />
              </span>
            </span>
            <button
              type="button"
              className="workspace-signout"
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="workspace-container workspace-main">
        <section className="workspace-hero">
          <div className="workspace-hero-copy">
            <p className="workspace-eyebrow">Your workspace</p>
            <h1>Your ideas, in one place.</h1>
            <p>
              Create, open and manage your diagrams. Continue where you left
              off, and turn your ideas into clear diagrams and real code with
              AI.
            </p>
          </div>
          <HeroArt />
        </section>

        <div className="workspace-create-wrap" id="create-board">
          <DoodleSparks className="workspace-create-doodle" />
          <form className="workspace-create" onSubmit={handleCreate}>
            <span className="workspace-create-icon" aria-hidden="true">
              <BoardIcon />
            </span>
            <label className="workspace-sr-only" htmlFor="new-board-title">
              New board title
            </label>
            <input
              id="new-board-title"
              ref={createInputRef}
              className="workspace-create-input"
              placeholder="New board title..."
              value={title}
              maxLength={120}
              disabled={creating}
              onChange={(event) => setTitle(event.target.value)}
            />
            <button
              className="workspace-create-submit"
              type="submit"
              disabled={creating || !title.trim()}
            >
              <Sparkle size={17} />
              {creating ? "Creating..." : "Create board"}
            </button>
          </form>
        </div>

        {error ? (
          <div className="workspace-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => void refresh()}>
              Retry
            </button>
          </div>
        ) : null}

        <section className="workspace-recent" id="recent">
          <div className="workspace-section-head">
            <div>
              <h2>Recent boards</h2>
              <p>Your latest diagrams and AI work.</p>
            </div>
            {boards.length > RECENT_LIMIT ? (
              <button
                type="button"
                className="workspace-view-all"
                onClick={() => setShowAll((value) => !value)}
              >
                {showAll ? "Show less" : "View all"}
                <ArrowRight size={16} />
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="workspace-skeleton" aria-hidden="true">
              <div className="workspace-skeleton-preview" />
              <div className="workspace-skeleton-lines">
                <span />
                <span />
              </div>
            </div>
          ) : boards.length === 0 ? (
            <div className="workspace-empty">
              <span className="workspace-empty-icon">
                <BoardIcon />
              </span>
              <h3>No boards yet</h3>
              <p>Name your first board above and start drawing with AI.</p>
            </div>
          ) : (
            <div className="workspace-board-list">
              {visibleBoards.map((board) => (
                <article key={board.id} className="workspace-board">
                  <Link
                    to={`/board/${board.id}`}
                    className="workspace-preview-link"
                    aria-label={`Open ${board.title}`}
                  >
                    <span className="workspace-preview">
                      <BoardPreview seed={board.id} />
                    </span>
                  </Link>

                  <div className="workspace-board-body">
                    <div className="workspace-board-top">
                      <div className="workspace-board-title-wrap">
                        {editingId === board.id ? (
                          <input
                            className="workspace-title-input"
                            value={editingTitle}
                            maxLength={120}
                            autoFocus
                            aria-label="Board title"
                            onChange={(event) =>
                              setEditingTitle(event.target.value)
                            }
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
                          <Link
                            className="workspace-board-title"
                            to={`/board/${board.id}`}
                          >
                            {board.title}
                          </Link>
                        )}
                        <p className="workspace-board-date">
                          Updated {formatUpdated(board.updatedAt)}
                        </p>
                      </div>

                      <div
                        className="workspace-menu-wrap"
                        onBlur={(event) => {
                          if (
                            !(event.relatedTarget instanceof Node) ||
                            !event.currentTarget.contains(event.relatedTarget)
                          ) {
                            setMenuId(null);
                          }
                        }}
                      >
                        <button
                          type="button"
                          className="workspace-kebab"
                          aria-label={`More options for ${board.title}`}
                          aria-haspopup="menu"
                          aria-expanded={menuId === board.id}
                          onClick={() =>
                            setMenuId((current) =>
                              current === board.id ? null : board.id,
                            )
                          }
                        >
                          <KebabIcon />
                        </button>
                        {menuId === board.id ? (
                          <div className="workspace-menu" role="menu">
                            <Link
                              to={`/board/${board.id}`}
                              role="menuitem"
                              className="workspace-menu-item"
                            >
                              <ExternalIcon /> Open board
                            </Link>
                            <button
                              type="button"
                              role="menuitem"
                              className="workspace-menu-item"
                              onClick={() => {
                                setMenuId(null);
                                startRename(board);
                              }}
                            >
                              <PencilIcon /> Rename
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="workspace-menu-item workspace-menu-danger"
                              onClick={() => {
                                setMenuId(null);
                                void handleDelete(board);
                              }}
                            >
                              <TrashIcon /> Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="workspace-board-actions">
                      <Link
                        className="workspace-action workspace-action-open"
                        to={`/board/${board.id}`}
                      >
                        <ExternalIcon /> Open board
                      </Link>
                      <button
                        type="button"
                        className="workspace-action workspace-action-rename"
                        onClick={() => startRename(board)}
                      >
                        <PencilIcon /> Rename
                      </button>
                      <button
                        type="button"
                        className="workspace-action workspace-action-delete"
                        onClick={() => void handleDelete(board)}
                      >
                        <TrashIcon /> Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="workspace-templates" id="templates">
          <DoodleSparks className="workspace-templates-doodle" />
          <span className="workspace-templates-icon" aria-hidden="true">
            <TemplateIcon />
          </span>
          <div className="workspace-templates-copy">
            <p className="workspace-eyebrow">Get started faster</p>
            <h2>Start with a template</h2>
            <p>
              Explore ready-to-use templates for system design, product ideas,
              user flows and more.
            </p>
          </div>
          <div className="workspace-template-thumbs">
            <TemplateThumb variant="flow" />
            <TemplateThumb variant="steps" />
            <TemplateThumb variant="mind" />
          </div>
          <button
            type="button"
            className="workspace-templates-btn"
            onClick={focusCreate}
          >
            Browse templates <ArrowRight size={15} />
          </button>
        </section>
      </main>
    </div>
  );
}
