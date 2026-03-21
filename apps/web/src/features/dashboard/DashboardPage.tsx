import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchDashboardStats } from "@core/api/client";
import type { DashboardStats } from "@core/types";
import { Card, CardContent, CardHeader, CardTitle } from "@core/ui/Card";
import { Spinner } from "@core/ui/Spinner";
import { FolderKey, Key, Users, Activity, Server, Cloud } from "lucide-react";

const envColors: Record<string, string> = {
  local: "bg-blue-500",
  dev: "bg-warning-500",
  prod: "bg-danger-500",
};

const envLabels: Record<string, string> = {
  local: "Local",
  dev: "Development",
  prod: "Production",
};

const actionLabels: Record<string, string> = {
  secret_created: "Secret olusturuldu",
  secret_updated: "Secret guncellendi",
  secret_deleted: "Secret silindi",
  secret_copied: "Secret kopyalandi",
  secret_exported: "Secret disari aktarildi",
  secret_revealed: "Secret goruntulendi",
  secret_restored: "Secret geri yuklendi",
  invite_created: "Davet olusturuldu",
  invite_rotated: "Davet yenilendi",
  invite_revoked: "Davet iptal edildi",
  member_joined: "Uye katildi",
  service_exported: "Servis aktarimi",
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Az once";
  if (minutes < 60) return `${minutes} dk once`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat once`;
  const days = Math.floor(hours / 24);
  return `${days} gun once`;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetchDashboardStats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "Veriler yuklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6"><Spinner /></div>;
  if (error) return (
    <div className="p-6">
      <div className="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]">
        {error}
      </div>
    </div>
  );
  if (!stats) return null;

  const maxEnvCount = Math.max(...Object.values(stats.secretsByEnvironment), 1);
  const providerEntries = Object.entries(stats.secretsByProvider).sort((a, b) => b[1] - a[1]);
  const maxProviderCount = Math.max(...providerEntries.map(([, c]) => c), 1);

  return (
    <div className="p-6 space-y-6">
      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="cursor-pointer transition-colors hover:border-[var(--primary)]/50" onClick={() => navigate("/projects")}>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/15">
              <Key className="h-5 w-5 text-brand-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalSecrets}</p>
              <p className="text-sm text-[var(--muted-foreground)]">Toplam Secret</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer transition-colors hover:border-[var(--primary)]/50" onClick={() => navigate("/projects")}>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15">
              <FolderKey className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalProjects}</p>
              <p className="text-sm text-[var(--muted-foreground)]">Toplam Proje</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/15">
              <Users className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalMembers}</p>
              <p className="text-sm text-[var(--muted-foreground)]">Toplam Uye</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Secrets by Environment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-4 w-4 text-[var(--muted-foreground)]" />
              Ortam Bazli Dagilim
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats.secretsByEnvironment).map(([env, count]) => (
              <div key={env} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{envLabels[env] ?? env}</span>
                  <span className="font-medium">{count}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--muted)]">
                  <div
                    className={`h-2 rounded-full transition-all ${envColors[env] ?? "bg-[var(--primary)]"}`}
                    style={{ width: `${(count / maxEnvCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {Object.keys(stats.secretsByEnvironment).length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)]">Henuz secret eklenmemis.</p>
            )}
          </CardContent>
        </Card>

        {/* Secrets by Provider */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cloud className="h-4 w-4 text-[var(--muted-foreground)]" />
              Saglayici Bazli Dagilim
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {providerEntries.map(([provider, count]) => (
              <div key={provider} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{provider}</span>
                  <span className="font-medium">{count}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--muted)]">
                  <div
                    className="h-2 rounded-full bg-[var(--primary)] transition-all"
                    style={{ width: `${(count / maxProviderCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {providerEntries.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)]">Henuz secret eklenmemis.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-[var(--muted-foreground)]" />
            Son Aktiviteler
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentActivity.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">Henuz aktivite yok.</p>
          ) : (
            <div className="space-y-3">
              {stats.recentActivity.map((event) => (
                <div key={event.id} className="flex items-center justify-between border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {actionLabels[event.action] ?? event.action}
                    </span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {event.actor}{event.secretName ? ` - ${event.secretName}` : ""}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
                    {formatRelativeTime(event.occurredAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
