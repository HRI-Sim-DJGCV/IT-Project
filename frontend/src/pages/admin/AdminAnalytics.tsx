import { useEffect, useState } from 'react'
import type { WeeklyReportData } from '../../api'
import {
  generateAnalytics,
  getAnalyticsDashboard,
  getAnalyticsReports,
  getAnalyticsSummary,
} from '../../api'
import { Button, ErrorText, Loading } from '../../components/ui'
import { AdminLayout } from './AdminLayout'

export function AdminAnalytics() {
  const [dashboard, setDashboard] = useState<WeeklyReportData | null>(null)
  const [reports, setReports] = useState<WeeklyReportData[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [dashboardRes, reportsRes, summaryRes] = await Promise.all([
        getAnalyticsDashboard(),
        getAnalyticsReports(page, 10),
        getAnalyticsSummary(),
      ])
      setDashboard(dashboardRes.report)
      setReports(reportsRes.reports)
      setSummary(summaryRes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateReport() {
    setGenerating(true)
    setGenerateError(null)
    try {
      await generateAnalytics()
      // Reload data after generation
      await loadData()
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [page])

  if (loading) {
    return (
      <AdminLayout title="Analytics">
        <Loading />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title="Analytics">
      <ErrorText>{error}</ErrorText>

      {/* Metrics Cards */}
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold text-ink">This week</h2>
        {dashboard ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              label="Walks"
              value={dashboard.totalWalks}
              detail={`${dashboard.completedWalks} completed`}
            />
            <MetricCard
              label="Completion"
              value={`${dashboard.completionRate.toFixed(1)}%`}
              detail={`${dashboard.completedWalks}/${dashboard.totalWalks}`}
            />
            <MetricCard
              label="Participants"
              value={dashboard.activeParticipants}
              detail={`of ${dashboard.totalParticipants}`}
            />
            <MetricCard
              label="Avg Calm Score"
              value={dashboard.averageCalmScore.toFixed(1)}
              detail="post-walk"
            />
          </div>
        ) : (
          <div className="rounded-lg border border-primary bg-card p-4 text-center">
            <p className="text-sm text-muted">No analytics data yet.</p>
            <p className="text-xs text-muted">Reports are generated every Monday at 00:00 UTC.</p>
          </div>
        )}
      </section>

      {/* Weekly Reports */}
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold text-ink">Weekly reports</h2>
        </div>
        {reports.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-primary bg-card">
                  <th className="px-2 py-2 text-left font-semibold text-muted">Week</th>
                  <th className="px-2 py-2 text-right font-semibold text-muted">Walks</th>
                  <th className="px-2 py-2 text-right font-semibold text-muted">Completion</th>
                  <th className="px-2 py-2 text-right font-semibold text-muted">Calm</th>
                  <th className="px-2 py-2 text-right font-semibold text-muted">Participants</th>
                  <th className="px-2 py-2 text-left font-semibold text-muted">Top Route</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report._id} className="border-b border-line">
                    <td className="px-2 py-2 text-ink">
                      {new Date(report.week).toLocaleDateString('en-AU', {
                        weekday: 'short',
                        year: '2-digit',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-2 py-2 text-right text-ink">{report.totalWalks}</td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <div className="h-1 w-12 flex-shrink-0 rounded bg-line">
                          <div
                            className="h-1 bg-primary"
                            style={{ width: `${report.completionRate}%` }}
                          />
                        </div>
                        <span className="text-ink">{report.completionRate.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right text-ink">{report.averageCalmScore.toFixed(1)}</td>
                    <td className="px-2 py-2 text-right text-ink">{report.activeParticipants}</td>
                    <td className="px-2 py-2 text-ink">{report.topRouteType || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-primary bg-card p-4 text-center">
            <p className="text-sm text-muted">No weekly reports yet.</p>
          </div>
        )}
      </section>

      {/* Summary Stats */}
      {summary && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-bold text-ink">All-time stats</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Weekly Reports"
              value={summary.reports.total}
              detail={
                summary.reports.latest
                  ? `Latest: ${new Date(summary.reports.latest.week).toLocaleDateString()}`
                  : 'None yet'
              }
            />
            <StatCard
              label="Total Walks"
              value={summary.metrics.totalWalksAllTime}
              detail={`${summary.metrics.totalCompletedAllTime} completed`}
            />
            <StatCard
              label="Overall Completion"
              value={`${summary.metrics.overallCompletionRate.toFixed(1)}%`}
              detail="All time"
            />
            <StatCard
              label="Metrics Recorded"
              value={summary.metrics.participantMetricsRecorded}
              detail="participant snapshots"
            />
          </div>
        </section>
      )}

      {/* Generate Report Button */}
      <div className="mt-auto flex flex-col gap-2.5 pt-4">
        <ErrorText>{generateError}</ErrorText>
        <Button onClick={handleGenerateReport} disabled={generating}>
          {generating ? 'Generating…' : '⚡ Generate Report (Manual)'}
        </Button>
      </div>
    </AdminLayout>
  )
}

function MetricCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-card p-3">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="text-lg font-bold text-ink">{value}</p>
      <p className="text-xs text-muted">{detail}</p>
    </div>
  )
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-card p-3">
      <p className="text-xs font-semibold uppercase text-muted">{label}</p>
      <p className="text-lg font-bold text-ink">{value}</p>
      <p className="text-xs text-muted">{detail}</p>
    </div>
  )
}
