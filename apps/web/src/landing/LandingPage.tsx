import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import "./landing.css";

const PRISMA_TEXT = `model User {
  id    String @id @default(cuid())
  name  String
  email String @unique
  posts Post[]
}

model Post {
  id        String  @id @default(cuid())
  title     String
  content   String?
  published Boolean @default(false)
  author    User    @relation(fields: [authorId], references: [id])
  authorId  String
}`;

const arrowPath = (
  <path
    d="M5 12h14M13 6l6 6-6 6"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

function ArrowRight({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {arrowPath}
    </svg>
  );
}

function Check({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 12.5 9.5 18 20 6.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BrandMark({ size = 28 }: { size?: number }) {
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

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" />
      <path d="M10 8.5 16 12l-6 3.5v-7Z" fill="currentColor" />
    </svg>
  );
}

function Sparkle({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 6.8C4 5.8 4.8 5 5.8 5h12.4c1 0 1.8.8 1.8 1.8v7.4c0 1-.8 1.8-1.8 1.8H9l-4 3v-3H5.8c-1 0-1.8-.8-1.8-1.8V6.8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m8 7-4 5 4 5M16 7l4 5-4 5M13.5 5l-3 14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CleanIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m14 5 5 5M13 20l-8-8 5-5 8 8-5 5ZM4 20l3-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3 19c.6-3 3-4.6 6-4.6s5.4 1.6 6 4.6M15.5 14.6c2.5.2 4.5 1.7 5 4.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GenerateIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M11.5 12v4M9.5 14h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 19V5M6 11l6-6 6 6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MiniIcon({ variant }: { variant: string }) {
  const paths: Record<string, ReactNode> = {
    undo: <path d="M9 14 4 9l5-5M4 9h9a6 6 0 0 1 0 12h-2" />,
    redo: <path d="m15 14 5-5-5-5M20 9h-9a6 6 0 0 0 0 12h2" />,
    pointer: <path d="m5 3 14 7-6 1.6L10 18 5 3Z" />,
    frame: <path d="M4 8h16M4 16h16M8 4v16M16 4v16" />,
    shape: <path d="M5 7h9v9H5zM14 7l5 4-5 4" />,
    pen: <path d="m4 20 4-1 11-11-3-3L5 16l-1 4Z" />,
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[variant] ?? paths.pointer}
    </svg>
  );
}

function ArrowMarker({ id }: { id: string }) {
  return (
    <defs>
      <marker
        id={id}
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="5"
        markerHeight="5"
        orient="auto-start-reverse"
      >
        <path d="M0 0 10 5 0 10Z" fill="#6b6678" />
      </marker>
    </defs>
  );
}

function Arrow({
  d,
  marker,
  dashed = false,
}: {
  d: string;
  marker: string;
  dashed?: boolean;
}) {
  return (
    <path
      d={d}
      fill="none"
      stroke="#6b6678"
      strokeWidth="1.1"
      strokeLinecap="round"
      markerEnd={`url(#${marker})`}
      strokeDasharray={dashed ? "4 4" : undefined}
    />
  );
}

function SvgNode({
  x,
  y,
  w,
  h,
  fill,
  stroke,
  label,
  sub,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  stroke: string;
  label: string;
  sub?: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="7"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.1"
      />
      <text
        x={x + w / 2}
        y={sub ? y + h / 2 - 1.5 : y + h / 2 + 3.6}
        textAnchor="middle"
        fontSize="9.5"
        fontWeight="600"
        fill="#2b2933"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {label}
      </text>
      {sub ? (
        <text
          x={x + w / 2}
          y={y + h / 2 + 9}
          textAnchor="middle"
          fontSize="6.8"
          fill="#6c6878"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {sub}
        </text>
      ) : null}
    </g>
  );
}

function Toolbar() {
  return (
    <div className="mock-toolbar">
      <div className="mock-toolbar-icons">
        {["undo", "redo", "pointer", "frame", "shape", "pen"].map((variant) => (
          <span key={variant} className="mock-tool">
            <MiniIcon variant={variant} />
          </span>
        ))}
      </div>
      <div className="mock-colors">
        <span style={{ background: "#17161a" }} />
        <span style={{ background: "#f3a3c6" }} />
        <span style={{ background: "#ffd94a" }} />
        <span style={{ background: "#6f9bf8" }} />
        <span style={{ background: "#8fd9b0" }} />
      </div>
      <div className="mock-toolbar-right">
        <span className="mock-zoom">100%</span>
        <span className="mock-share">Share</span>
      </div>
    </div>
  );
}

function HeroDiagram() {
  return (
    <svg
      viewBox="0 0 560 400"
      className="mock-svg"
      role="img"
      aria-label="System architecture diagram with user, web app, API, database, AI agent, external API and cache"
    >
      <ArrowMarker id="hero-arrow" />
      <Arrow d="M125 86h30" marker="hero-arrow" />
      <Arrow d="M240 86h30" marker="hero-arrow" />
      <Arrow d="M355 86h30" marker="hero-arrow" />
      <Arrow d="M197 114c8 18 18 32 30 46" marker="hero-arrow" />
      <Arrow d="M255 192c-10 22-28 46-42 68" marker="hero-arrow" />
      <Arrow d="M305 192c10 22 24 46 36 68" marker="hero-arrow" />
      <SvgNode
        x={40}
        y={70}
        w={85}
        h={32}
        fill="#ece2ff"
        stroke="#b79df0"
        label="User"
      />
      <SvgNode
        x={155}
        y={64}
        w={85}
        h={44}
        fill="#dce9ff"
        stroke="#91b4f2"
        label="Web App"
        sub="(frontend)"
      />
      <SvgNode
        x={270}
        y={64}
        w={85}
        h={44}
        fill="#fff1c9"
        stroke="#e8cd76"
        label="API"
        sub="(backend)"
      />
      <SvgNode
        x={385}
        y={70}
        w={85}
        h={32}
        fill="#e7e2ff"
        stroke="#b3a4eb"
        label="Database"
      />
      <SvgNode
        x={205}
        y={160}
        w={100}
        h={32}
        fill="#ffe6bd"
        stroke="#edb968"
        label="AI Agent"
      />
      <SvgNode
        x={75}
        y={260}
        w={105}
        h={32}
        fill="#ffdcdc"
        stroke="#eca3a3"
        label="External API"
      />
      <SvgNode
        x={330}
        y={260}
        w={80}
        h={32}
        fill="#d9f6e4"
        stroke="#8fd3a8"
        label="Cache"
      />
    </svg>
  );
}

function AiPane() {
  const rows = [
    ["Ask about your diagram", "Get answers to questions about your diagram."],
    ["Fix things", "Create, update or improve your diagram."],
    ["Clean up", "Improve the readability of your diagram."],
    ["Collaborate", "Share and review updates in real time."],
    ["Generate", "Create diagrams from a description."],
  ];

  return (
    <aside className="ai-pane">
      <div className="ai-pane-head">
        <span className="ai-pane-brand">
          <span className="ai-pane-dot" /> AI
        </span>
        <button type="button" className="ai-add" aria-label="Start a new AI chat">
          +
        </button>
      </div>
      <div className="ai-pills">
        {["Ask", "To code", "Clean up", "Collaborate", "Generate"].map(
          (pill, index) => (
            <span key={pill} className={index === 0 ? "ai-pill-active" : ""}>
              {pill}
            </span>
          ),
        )}
      </div>
      <div className="ai-rows">
        <p className="ai-ask">Ask about your diagram...</p>
        {rows.map(([title, copy]) => (
          <div key={title} className="ai-row">
            <span className="ai-row-dot" />
            <div>
              <strong>{title}</strong>
              <span>{copy}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="ai-mini-input">
        <span>Ask about your diagram...</span>
        <span className="ai-mini-send">
          <SendIcon />
        </span>
      </div>
    </aside>
  );
}

const logos = [
  {
    name: "ACME",
    icon: <path d="M3 15 9 4l6 11H3Z" />,
  },
  {
    name: "Nimbus",
    icon: (
      <>
        <circle cx="9" cy="9" r="6" />
        <path d="M3 9h12" />
      </>
    ),
  },
  {
    name: "PixelCraft",
    icon: (
      <>
        <rect x="3" y="3" width="5" height="5" />
        <rect x="10" y="3" width="5" height="5" />
        <rect x="3" y="10" width="5" height="5" />
        <rect x="10" y="10" width="5" height="5" />
      </>
    ),
  },
  {
    name: "Orion",
    icon: <path d="m9 2 1.7 5.3L16 9l-5.3 1.7L9 16l-1.7-5.3L2 9l5.3-1.7L9 2Z" />,
  },
  {
    name: "Layers",
    icon: (
      <>
        <path d="m9 2 7 4-7 4-7-4 7-4Z" />
        <path d="m2 10 7 4 7-4" />
      </>
    ),
  },
  {
    name: "Hexa",
    icon: <path d="M9 2 15.5 5.7v6.6L9 16l-6.5-3.7V5.7L9 2Z" />,
  },
  {
    name: "AutoFlow",
    icon: (
      <>
        <circle cx="9" cy="9" r="6.5" />
        <path d="M6.5 9h5M9 6.5v5" />
      </>
    ),
  },
];

const tools = [
  {
    title: "Ask",
    copy: "Get instant answers about your diagram and highlight relevant shapes.",
    icon: <ChatIcon />,
    wide: true,
  },
  {
    title: "To code",
    copy: "Convert diagrams to Prisma, SQL, MongoDB, Mermaid and JSON.",
    icon: <CodeIcon />,
    wide: true,
  },
  {
    title: "Clean up",
    copy: "Automatically organize your diagram and improve readability.",
    icon: <CleanIcon />,
  },
  {
    title: "Collaborate",
    copy: "Work together on the same canvas in real time.",
    icon: <PeopleIcon />,
  },
  {
    title: "Generate",
    copy: "Create diagrams from a text description.",
    icon: <GenerateIcon />,
  },
];

function ToolsSection() {
  return (
    <section className="landing-tools" id="product">
      <div className="landing-container tools-grid">
        <div className="tools-copy">
          <p className="landing-eyebrow">AI diagramming</p>
          <h2>
            Five AI tools.
            <br />
            One faster way
            <br />
            to think.
          </h2>
          <p className="landing-lead">
            Everything you need to go from ideas to clear diagrams and real
            code.
          </p>
          <a className="landing-btn landing-btn-dark" href="#features">
            Explore all features <ArrowRight />
          </a>
        </div>
        <div className="tools-bento">
          {tools.map((tool) => (
            <article
              key={tool.title}
              className={`tool-card${tool.wide ? " tool-card-wide" : ""}`}
            >
              <span className="tool-icon">{tool.icon}</span>
              <div className="tool-card-copy">
                <h3>{tool.title}</h3>
                <p>{tool.copy}</p>
              </div>
              <span className="tool-arrow">
                <ArrowRight size={14} />
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function RealIdeasDiagram() {
  return (
    <svg
      viewBox="0 0 520 350"
      className="mock-svg"
      role="img"
      aria-label="Order service diagram with customer, order service, payment service, database, notification service and user"
    >
      <ArrowMarker id="ideas-arrow" />
      <Arrow d="M120 122h55" marker="ideas-arrow" />
      <Arrow d="M275 122h70" marker="ideas-arrow" />
      <Arrow d="M250 139v76" marker="ideas-arrow" />
      <Arrow d="M280 130c30 24 55 55 75 78" marker="ideas-arrow" />
      <Arrow d="M410 139v76" marker="ideas-arrow" />
      <Arrow d="M410 247c-5 25-25 42-40 54" marker="ideas-arrow" dashed />
      <text
        x="318"
        y="278"
        fontSize="8"
        fontStyle="italic"
        fill="#6b6678"
        fontFamily="Inter, system-ui, sans-serif"
      >
        send email
      </text>
      <SvgNode
        x={20}
        y={105}
        w={100}
        h={34}
        fill="#ece2ff"
        stroke="#b79df0"
        label="Customer"
      />
      <SvgNode
        x={175}
        y={105}
        w={100}
        h={34}
        fill="#dce9ff"
        stroke="#91b4f2"
        label="Order Service"
      />
      <SvgNode
        x={345}
        y={105}
        w={130}
        h={34}
        fill="#d9f6e4"
        stroke="#8fd3a8"
        label="Payment Service"
      />
      <SvgNode
        x={195}
        y={215}
        w={90}
        h={32}
        fill="#d9f6e4"
        stroke="#8fd3a8"
        label="Database"
      />
      <SvgNode
        x={345}
        y={215}
        w={130}
        h={32}
        fill="#fff1c9"
        stroke="#e8cd76"
        label="Notification Service"
      />
      <SvgNode
        x={440}
        y={300}
        w={70}
        h={30}
        fill="#ece2ff"
        stroke="#b79df0"
        label="User"
      />
    </svg>
  );
}

function VisualizeSection() {
  return (
    <section className="landing-visualize" id="features">
      <div className="landing-container visualize-grid">
        <div className="visualize-copy">
          <p className="landing-eyebrow">Visualize anything</p>
          <h2>
            Diagrams for
            <br />
            real ideas.
          </h2>
          <p className="landing-lead">
            Design systems, plan architecture, map workflows and explore
            concepts — with the help of AI.
          </p>
          <ul className="landing-check-list">
            {[
              "Software architecture",
              "User flows",
              "Database schemas",
              "Product ideas",
              "And much more",
            ].map((item) => (
              <li key={item}>
                <span className="check-box">
                  <Check size={10} />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <Link className="landing-btn landing-btn-dark" to="/login">
            Start drawing free <ArrowRight />
          </Link>
        </div>
        <div className="visualize-visual">
          <DecorativeScribble className="scribble-blue" />
          <div className="mock-window ideas-window">
            <div className="mock-toolbar">
              <div className="mock-toolbar-icons">
                {["undo", "redo", "pointer", "frame", "shape", "pen"].map(
                  (variant) => (
                    <span key={variant} className="mock-tool">
                      <MiniIcon variant={variant} />
                    </span>
                  ),
                )}
              </div>
              <div className="mock-toolbar-right">
                <span className="library-pill">
                  <span className="library-glyph" /> Library
                </span>
              </div>
            </div>
            <div className="ideas-canvas">
              <RealIdeasDiagram />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DecorativeScribble({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 46 26"
      className={`scribble ${className ?? ""}`}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 20 12 9M12 9l-2 7M12 9l-6 2M24 23l7-15M31 8l-3 6M31 8l-5 1M39 4v6M45 7l-3-2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CodeMock() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(PRISMA_TEXT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const lines: ReactNode[] = [
    <>
      <span className="tok-kw">model</span>{" "}
      <span className="tok-name">User</span>{" "}
      <span className="tok-punc">{"{"}</span>
    </>,
    <>
      {"  "}
      <span className="tok-prop">id</span>
      {"        "}
      <span className="tok-type">String</span>
      {"   "}
      <span className="tok-attr">@id @default(cuid())</span>
    </>,
    <>
      {"  "}
      <span className="tok-prop">name</span>
      {"      "}
      <span className="tok-type">String</span>
    </>,
    <>
      {"  "}
      <span className="tok-prop">email</span>
      {"     "}
      <span className="tok-type">String</span>
      {"   "}
      <span className="tok-attr">@unique</span>
    </>,
    <>
      {"  "}
      <span className="tok-prop">posts</span>
      {"     "}
      <span className="tok-type">Post[]</span>
    </>,
    <span className="tok-punc">{"}"}</span>,
    <>&nbsp;</>,
    <>
      <span className="tok-kw">model</span>{" "}
      <span className="tok-name">Post</span>{" "}
      <span className="tok-punc">{"{"}</span>
    </>,
    <>
      {"  "}
      <span className="tok-prop">id</span>
      {"        "}
      <span className="tok-type">String</span>
      {"   "}
      <span className="tok-attr">@id @default(cuid())</span>
    </>,
    <>
      {"  "}
      <span className="tok-prop">title</span>
      {"     "}
      <span className="tok-type">String</span>
    </>,
    <>
      {"  "}
      <span className="tok-prop">content</span>
      {"   "}
      <span className="tok-type">String?</span>
    </>,
    <>
      {"  "}
      <span className="tok-prop">published</span>
      {" "}
      <span className="tok-type">Boolean</span>
      {"   "}
      <span className="tok-attr">@default(false)</span>
    </>,
    <>
      {"  "}
      <span className="tok-prop">author</span>
      {"    "}
      <span className="tok-type">User</span>
      {"  "}
      <span className="tok-attr">
        @relation(fields: [authorId], references: [id])
      </span>
    </>,
    <>
      {"  "}
      <span className="tok-prop">authorId</span>
      {"  "}
      <span className="tok-type">String</span>
    </>,
    <span className="tok-punc">{"}"}</span>,
  ];

  return (
    <div className="code-window">
      <div className="code-window-head">
        <span className="code-file">schema.prisma</span>
        <button type="button" className="code-copy" onClick={handleCopy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="code-body">
        <code>
          {lines.map((line, index) => (
            <span key={index} className="code-line">
              {line}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

function CodeSection() {
  return (
    <section className="landing-code">
      <div className="landing-container code-grid">
        <div className="code-copy">
          <p className="landing-eyebrow">Turn diagrams into code</p>
          <h2>
            From visual
            <br />
            thinking to
            <br />
            working code.
          </h2>
          <p className="landing-lead">
            Convert your ER or system diagrams into production-ready code.
            Export as Prisma, SQL, MongoDB, Mermaid or JSON — with a clean,
            accurate output.
          </p>
          <div className="code-badges">
            {[
              ["Prisma", "prisma"],
              ["SQL", "sql"],
              ["MongoDB", "mongo"],
              ["Mermaid", "mermaid"],
              ["JSON", "json"],
            ].map(([label, key]) => (
              <span key={key} className="code-badge">
                <span className={`code-badge-dot ${key}`} />
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="code-visual">
          <DecorativeScribble className="scribble-ink" />
          <CodeMock />
        </div>
      </div>
    </section>
  );
}

function CollabDiagram() {
  return (
    <svg
      viewBox="0 0 460 300"
      className="mock-svg"
      role="img"
      aria-label="Web infrastructure diagram with client, load balancer, web server, cache and database"
    >
      <ArrowMarker id="collab-arrow" />
      <Arrow d="M110 58h55" marker="collab-arrow" />
      <Arrow d="M275 58h45" marker="collab-arrow" />
      <Arrow d="M250 75c-15 35-25 90-25 155" marker="collab-arrow" />
      <Arrow d="M370 75v75" marker="collab-arrow" dashed />
      <Arrow d="M355 168c-10 25-45 42-75 62" marker="collab-arrow" />
      <SvgNode
        x={20}
        y={41}
        w={90}
        h={34}
        fill="#dce9ff"
        stroke="#91b4f2"
        label="Client"
      />
      <SvgNode
        x={165}
        y={41}
        w={110}
        h={34}
        fill="#f3ede1"
        stroke="#cfc5b2"
        label="Load Balancer"
      />
      <SvgNode
        x={320}
        y={41}
        w={105}
        h={34}
        fill="#d9f6e4"
        stroke="#8fd3a8"
        label="Web Server"
      />
      <SvgNode
        x={330}
        y={150}
        w={90}
        h={34}
        fill="#d9f6e4"
        stroke="#8fd3a8"
        label="Cache"
        sub="(Redis)"
      />
      <SvgNode
        x={165}
        y={230}
        w={130}
        h={34}
        fill="#ece2ff"
        stroke="#b79df0"
        label="Database"
        sub="(PostgreSQL)"
      />
    </svg>
  );
}

function CollaborateSection() {
  return (
    <section className="landing-collab">
      <div className="landing-container collab-grid">
        <div className="collab-photo">
          <div className="collab-photo-glow collab-photo-glow-a" />
          <div className="collab-photo-glow collab-photo-glow-b" />
          <div className="collab-comment collab-comment-top">
            <div className="comment-head">
              <span className="comment-avatar avatar-a">A</span>
              <span className="comment-name">@alex</span>
            </div>
            <p>
              This looks great! <Sparkle size={11} />
            </p>
          </div>
          <div className="collab-comment collab-comment-bottom">
            <div className="comment-head">
              <span className="comment-avatar avatar-b">P</span>
              <span className="comment-name">@priya</span>
            </div>
            <p>Can you add a caching layer?</p>
          </div>
        </div>
        <div className="collab-diagram">
          <CollabDiagram />
        </div>
        <div className="collab-copy">
          <p className="landing-eyebrow">Built together</p>
          <h2>Collaborate in real time.</h2>
          <p className="landing-lead">
            Work with your team on the same canvas. Share ideas, review diagrams
            and move faster together.
          </p>
          <Link className="landing-btn landing-btn-dark" to="/login">
            Try it now <ArrowRight />
          </Link>
        </div>
      </div>
    </section>
  );
}

function GenerateDiagram() {
  return (
    <svg
      viewBox="0 0 520 320"
      className="mock-svg"
      role="img"
      aria-label="Generated microservices architecture diagram with API gateway, services, database and message queue"
    >
      <ArrowMarker id="gen-arrow" />
      <Arrow d="M245 79c-22 22-60 42-95 61" marker="gen-arrow" />
      <Arrow d="M255 79v61" marker="gen-arrow" />
      <Arrow d="M278 79c22 22 60 42 90 61" marker="gen-arrow" />
      <Arrow d="M230 174c-8 22-20 44-30 66" marker="gen-arrow" />
      <Arrow d="M290 174c14 22 32 44 44 66" marker="gen-arrow" />
      <SvgNode
        x={200}
        y={45}
        w={110}
        h={34}
        fill="#dce9ff"
        stroke="#91b4f2"
        label="API Gateway"
      />
      <SvgNode
        x={40}
        y={140}
        w={100}
        h={34}
        fill="#dce9ff"
        stroke="#91b4f2"
        label="Auth Service"
      />
      <SvgNode
        x={195}
        y={140}
        w={110}
        h={34}
        fill="#dce9ff"
        stroke="#91b4f2"
        label="Chat Service"
      />
      <SvgNode
        x={355}
        y={140}
        w={100}
        h={34}
        fill="#dce9ff"
        stroke="#91b4f2"
        label="User Service"
      />
      <SvgNode
        x={150}
        y={240}
        w={100}
        h={32}
        fill="#ece2ff"
        stroke="#b79df0"
        label="Database"
      />
      <SvgNode
        x={310}
        y={240}
        w={120}
        h={32}
        fill="#ece2ff"
        stroke="#b79df0"
        label="Message Queue"
      />
    </svg>
  );
}

function GenerateSection() {
  return (
    <section className="landing-generate">
      <div className="landing-container generate-grid">
        <div className="generate-copy">
          <p className="landing-eyebrow">Ideas from text</p>
          <h2>
            Generate
            <br />
            diagrams instantly.
          </h2>
          <p className="landing-lead">
            Describe what you want, and let AI create a clean diagram in
            seconds. Perfect for brainstorming and exploring new ideas.
          </p>
          <Link className="landing-btn landing-btn-dark" to="/login">
            Try it now <ArrowRight />
          </Link>
        </div>
        <div className="generate-visual">
          <DecorativeScribble className="scribble-blue scribble-generate" />
          <div className="prompt-card">
            <span className="prompt-sparkle">
              <Sparkle size={16} />
            </span>
            <p>Generate a microservices architecture for a chat application</p>
            <button type="button" className="prompt-send" aria-label="Generate">
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="mock-window generate-window">
            <div className="generate-window-top">
              <span className="library-pill">
                <span className="library-glyph" /> Library
              </span>
            </div>
            <div className="generate-canvas">
              <GenerateDiagram />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CallToAction() {
  return (
    <section className="landing-cta" id="pricing">
      <div className="landing-container">
        <p className="landing-eyebrow">Start building today</p>
        <h2>
          <span className="cta-doodle" aria-hidden="true">
            <DecorativeScribble className="scribble-ink" />
          </span>
          Turn your next idea
          <br />
          into a clear diagram.
          <span className="cta-doodle cta-doodle-right" aria-hidden="true">
            <DecorativeScribble className="scribble-ink" />
          </span>
        </h2>
        <Link
          className="landing-btn landing-btn-dark landing-btn-large"
          to="/login"
        >
          Get started free <ArrowRight size={16} />
        </Link>
        <ul className="landing-trust landing-trust-center">
          {["No credit card required", "Free to start", "For individuals and teams"].map(
            (item) => (
              <li key={item}>
                <span className="trust-check">
                  <Check size={9} />
                </span>
                {item}
              </li>
            ),
          )}
        </ul>
      </div>
    </section>
  );
}

function SocialIcon({ name }: { name: string }) {
  const icons: Record<string, ReactNode> = {
    x: <path d="M4 4l16 16M20 4 4 20" />,
    github: (
      <path d="M9 19c-4 1.4-4-2-5.5-2.5M15 21v-3.2c0-.9.1-1.3-.4-1.8 2.7-.3 5.4-1.3 5.4-6a4.7 4.7 0 0 0-1.3-3.3 4.3 4.3 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 3.2 5.4 3.5 5.4 3.5a4.3 4.3 0 0 0-.1 3.2A4.7 4.7 0 0 0 4 10c0 4.7 2.7 5.7 5.4 6-.5.5-.5 1-.4 1.8V21" />
    ),
    linkedin: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M7.5 10.5V17M7.5 7.2v.1M11.5 17v-3.6c0-1.6.9-2.6 2.4-2.6 1.4 0 2.3 1 2.3 2.6V17" />
      </>
    ),
    youtube: (
      <>
        <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
        <path d="m10 9.5 5 2.5-5 2.5v-5Z" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  );
}

const footerColumns = [
  {
    title: "Product",
    links: ["Features", "Pricing", "Changelog", "Roadmap"],
  },
  {
    title: "Resources",
    links: ["Documentation", "Examples", "Templates", "Blog"],
  },
  {
    title: "Company",
    links: ["About", "Privacy", "Terms", "Contact"],
  },
];

export function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-container landing-nav-inner">
          <Link to="/" className="landing-brand" aria-label="TidyBoard home">
            <BrandMark />
            <span>TidyBoard</span>
          </Link>
          <nav className="landing-nav-links" aria-label="Main navigation">
            <a href="#product">Product</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#resources">Resources</a>
          </nav>
          <div className="landing-nav-actions">
            <Link to="/login" className="landing-btn landing-btn-ghost">
              Sign in
            </Link>
            <Link to="/login" className="landing-btn landing-btn-dark">
              Get started free <ArrowRight />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-container hero-grid">
            <div className="hero-copy">
              <h1>
                From a blank
                <br />
                canvas to a
                <br />
                clear <span className="hero-accent">system.</span>
              </h1>
              <p className="landing-lead">
                Draw, understand and build diagrams with AI — all in one place.
                TidyBoard helps you turn ideas into clear diagrams, answer
                questions, and connect them into real code.
              </p>
              <div className="hero-actions">
                <Link className="landing-btn landing-btn-dark" to="/login">
                  Start drawing free <ArrowRight />
                </Link>
                <a className="hero-demo" href="#features">
                  <PlayIcon /> Watch demo
                </a>
              </div>
              <ul className="landing-trust">
                {[
                  "No credit card required",
                  "Free to start",
                  "For individuals and teams",
                ].map((item) => (
                  <li key={item}>
                    <span className="trust-check">
                      <Check size={9} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="hero-visual">
              <div className="hero-annotation" aria-hidden="true">
                <span>
                  Ideas
                  <br />
                  Diagrams
                  <br />
                  Answers
                  <br />
                  Code
                </span>
                <svg viewBox="0 0 60 34" fill="none">
                  <path
                    d="M2 4c12 2 24 10 28 26m0 0-9-5m9 5 4-9"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="hero-sparkle" aria-hidden="true">
                <Sparkle size={30} />
              </div>
              <div className="mock-window hero-window">
                <Toolbar />
                <div className="hero-window-body">
                  <div className="hero-canvas">
                    <HeroDiagram />
                  </div>
                  <AiPane />
                </div>
              </div>
            </div>
          </div>
          <div className="landing-container logo-cloud">
            <p>Used by builders, teams and learners</p>
            <div className="logo-row">
              {logos.map((logo) => (
                <span key={logo.name} className="logo-item">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 18 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {logo.icon}
                  </svg>
                  {logo.name}
                </span>
              ))}
            </div>
          </div>
        </section>

        <ToolsSection />
        <VisualizeSection />
        <CodeSection />
        <CollaborateSection />
        <GenerateSection />
        <CallToAction />
      </main>

      <footer className="landing-footer" id="resources">
        <div className="landing-container footer-grid">
          <div className="footer-brand">
            <Link to="/" className="landing-brand" aria-label="TidyBoard home">
              <BrandMark size={26} />
              <span>TidyBoard</span>
            </Link>
            <p>Draw. Understand. Build with AI.</p>
            <div className="footer-socials">
              {["x", "github", "linkedin", "youtube"].map((name) => (
                <a key={name} href="#top" aria-label={name}>
                  <SocialIcon name={name} />
                </a>
              ))}
            </div>
          </div>
          {footerColumns.map((column) => (
            <div key={column.title} className="footer-column">
              <h3>{column.title}</h3>
              <ul>
                {column.links.map((link) => (
                  <li key={link}>
                    <a href="#product">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="footer-subscribe">
            <h3>Subscribe to updates</h3>
            <p>Get the latest features and news.</p>
            <form onSubmit={(event) => event.preventDefault()}>
              <input
                type="email"
                placeholder="Enter your email"
                aria-label="Email address"
              />
              <button type="submit" aria-label="Subscribe">
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>
      </footer>
    </div>
  );
}
