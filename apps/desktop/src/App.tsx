import { useMemo, useState } from "react";
import "./App.css";

type Environment = "Dev" | "Staging" | "Prod" | "Local";
type SecretStatus = "active" | "revoked";

type SecretItem = {
  id: string;
  provider: string;
  icon: string;
  name: string;
  environment: Environment;
  valueMasked: string;
  updatedAt: string;
  status: SecretStatus;
  createdOn: string;
  lastUsed: string;
  notes: string;
  snippets: {
    Node: string;
    Python: string;
    Go: string;
  };
};

const secrets: SecretItem[] = [
  {
    id: "stripe-prod",
    provider: "Stripe",
    icon: "S",
    name: "Stripe Payments",
    environment: "Prod",
    valueMasked: "sk_live_...8Xy9",
    updatedAt: "Updated 2h ago",
    status: "active",
    createdOn: "Oct 24, 2023",
    lastUsed: "Just now",
    notes: "Primary production key for processing payments. Do not rotate without notifying billing.",
    snippets: {
      Node: "import Stripe from \"stripe\";\nconst stripe = new Stripe(process.env.STRIPE_API_KEY!);\nawait stripe.customers.create({ description: \"First Customer\" });",
      Python: "import stripe\nstripe.api_key = \"sk_live_51Mz...Xy9\"\nstripe.Customer.create(description=\"First Customer\")",
      Go: "sc := &client.API{}\nsc.Init(os.Getenv(\"STRIPE_API_KEY\"), nil)\n_, _ = customer.New(&stripe.CustomerParams{Description: stripe.String(\"First Customer\")})",
    },
  },
  {
    id: "vercel-staging",
    provider: "Vercel",
    icon: "V",
    name: "Vercel Deploy Hook",
    environment: "Staging",
    valueMasked: "https://api.ver...",
    updatedAt: "Updated yesterday",
    status: "active",
    createdOn: "Dec 11, 2024",
    lastUsed: "2h ago",
    notes: "Webhook used by staging CI pipeline.",
    snippets: {
      Node: "fetch(process.env.VERCEL_DEPLOY_HOOK!, { method: \"POST\" });",
      Python: "requests.post(os.getenv(\"VERCEL_DEPLOY_HOOK\"))",
      Go: "http.Post(os.Getenv(\"VERCEL_DEPLOY_HOOK\"), \"application/json\", nil)",
    },
  },
  {
    id: "algolia-dev",
    provider: "Algolia",
    icon: "A",
    name: "Algolia Search",
    environment: "Dev",
    valueMasked: "search_only_...a1b",
    updatedAt: "Updated 5d ago",
    status: "active",
    createdOn: "Jan 03, 2025",
    lastUsed: "3d ago",
    notes: "Development search index key.",
    snippets: {
      Node: "const client = algoliasearch(appId, process.env.ALGOLIA_SEARCH_KEY!);",
      Python: "client = SearchClient.create(app_id, os.getenv(\"ALGOLIA_SEARCH_KEY\"))",
      Go: "client := search.NewClient(appID, os.Getenv(\"ALGOLIA_SEARCH_KEY\"))",
    },
  },
  {
    id: "sendgrid-local",
    provider: "SendGrid",
    icon: "M",
    name: "SendGrid API",
    environment: "Local",
    valueMasked: "SG.***********99",
    updatedAt: "Updated 2w ago",
    status: "active",
    createdOn: "Nov 17, 2024",
    lastUsed: "1w ago",
    notes: "Local email testing key.",
    snippets: {
      Node: "sgMail.setApiKey(process.env.SENDGRID_API_KEY!);",
      Python: "sg = SendGridAPIClient(os.getenv(\"SENDGRID_API_KEY\"))",
      Go: "request := sendgrid.GetRequest(os.Getenv(\"SENDGRID_API_KEY\"), \"/v3/mail/send\", \"https://api.sendgrid.com\")",
    },
  },
  {
    id: "legacy-revoked",
    provider: "Legacy",
    icon: "L",
    name: "Legacy Auth",
    environment: "Prod",
    valueMasked: "sk_legacy_...",
    updatedAt: "Revoked 1m ago",
    status: "revoked",
    createdOn: "Feb 13, 2022",
    lastUsed: "1m ago",
    notes: "Revoked after migration to new auth service.",
    snippets: {
      Node: "// Revoked key",
      Python: "# Revoked key",
      Go: "// Revoked key",
    },
  },
];

const envFilters: Array<"All" | Environment> = ["All", "Dev", "Staging", "Prod", "Local"];

function App() {
  const [activeEnv, setActiveEnv] = useState<(typeof envFilters)[number]>("All");
  const [activeSecretId, setActiveSecretId] = useState(secrets[0].id);
  const [activeSnippetLanguage, setActiveSnippetLanguage] = useState<"Node" | "Python" | "Go">("Python");

  const visibleSecrets = useMemo(() => {
    if (activeEnv === "All") {
      return secrets;
    }
    return secrets.filter((item) => item.environment === activeEnv);
  }, [activeEnv]);

  const activeSecret = visibleSecrets.find((item) => item.id === activeSecretId) ?? visibleSecrets[0];

  const handleCopySnippet = async () => {
    if (!activeSecret) {
      return;
    }

    try {
      await navigator.clipboard.writeText(activeSecret.snippets[activeSnippetLanguage]);
    } catch {
      // no-op on environments where clipboard is unavailable
    }
  };

  return (
    <div className="app-shell">
      <aside className="rail">
        <div className="rail-brand">SM</div>
        <button className="rail-item rail-item-active" type="button">
          AP
        </button>
        <button className="rail-item" type="button">
          EC
        </button>
        <button className="rail-item" type="button">
          AN
        </button>
        <button className="rail-item" type="button">
          CL
        </button>
        <div className="rail-spacer" />
        <button className="rail-item" type="button">
          +
        </button>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="project-title">Apollo Project</div>
          <div className="env-switcher">
            {envFilters.map((env) => (
              <button
                key={env}
                className={env === activeEnv ? "env-btn env-btn-active" : "env-btn"}
                onClick={() => setActiveEnv(env)}
                type="button"
              >
                {env}
              </button>
            ))}
          </div>
          <div className="topbar-actions">
            <button className="btn-secondary" type="button">
              Export
            </button>
            <button className="btn-primary" type="button">
              Add Entry
            </button>
          </div>
        </header>

        <section className="content-grid">
          <section className="table-panel">
            <div className="table-header-row">
              <span>Provider</span>
              <span>Name</span>
              <span>Environment</span>
              <span>Value</span>
            </div>

            {visibleSecrets.map((secret) => (
              <button
                key={secret.id}
                className={secret.id === activeSecret?.id ? "secret-row secret-row-active" : "secret-row"}
                type="button"
                onClick={() => setActiveSecretId(secret.id)}
              >
                <span className="provider-cell" title={secret.provider}>
                  <span className="provider-badge">{secret.icon}</span>
                </span>
                <span className="name-cell">
                  <strong>{secret.name}</strong>
                  <small>{secret.updatedAt}</small>
                </span>
                <span>
                  <span className={`env-tag env-${secret.environment.toLowerCase()}`}>{secret.environment}</span>
                </span>
                <span>
                  <code className={secret.status === "revoked" ? "masked-value is-revoked" : "masked-value"}>
                    {secret.valueMasked}
                  </code>
                </span>
              </button>
            ))}
          </section>

          <aside className="detail-panel">
            {activeSecret ? (
              <>
                <div className="detail-top">
                  <div>
                    <h2>{activeSecret.name}</h2>
                    <p>
                      {activeSecret.status === "active" ? "ACTIVE" : "REVOKED"} - {activeSecret.environment} Environment
                    </p>
                  </div>
                </div>

                <div className="detail-block">
                  <div className="block-header">
                    <strong>Quick Copy</strong>
                    <div className="snippet-tabs">
                      {(["Python", "Node", "Go"] as const).map((lang) => (
                        <button
                          key={lang}
                          className={lang === activeSnippetLanguage ? "snippet-tab active" : "snippet-tab"}
                          onClick={() => setActiveSnippetLanguage(lang)}
                          type="button"
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="code-panel">
                    <pre>{activeSecret.snippets[activeSnippetLanguage]}</pre>
                    <button className="copy-btn" onClick={handleCopySnippet} type="button">
                      Copy
                    </button>
                  </div>
                </div>

                <div className="detail-block">
                  <strong>Key Information</strong>
                  <div className="meta-grid">
                    <span>Full Key</span>
                    <code>{activeSecret.valueMasked}</code>
                    <span>Created On</span>
                    <strong>{activeSecret.createdOn}</strong>
                    <span>Last Used</span>
                    <strong className="accent">{activeSecret.lastUsed}</strong>
                  </div>
                </div>

                <div className="detail-block">
                  <strong>Notes</strong>
                  <p className="notes">{activeSecret.notes}</p>
                </div>

                <footer className="detail-footer">
                  <button type="button">View Audit Log</button>
                  <div>
                    <button type="button">Rotate</button>
                    <button type="button">Delete</button>
                  </div>
                </footer>
              </>
            ) : (
              <div className="empty-state">No secrets available in this environment.</div>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}

export default App;
