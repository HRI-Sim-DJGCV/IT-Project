import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  Alert, Box, Card, CardContent, CircularProgress,
  Divider, LinearProgress, Stack, Typography,
} from '@mui/material'
import type { WeeklyReportData } from '../../api'
import {
  generateAnalytics, getAnalyticsDashboard, getAnalyticsReports, getAnalyticsSummary,
  getAnalyticsWeeklyExportCsv,
} from '../../api'
import { downloadBlob } from '../../api/download'
import { getUtcWeekRange } from '@shared/week'
import { Button } from '../../components/ui'
import { AdminLayout } from './AdminLayout'

interface AnalyticsSummary {
  reports: { total: number; latest: WeeklyReportData | null }
  metrics: {
    participantMetricsRecorded: number
    totalWalksAllTime: number
    totalCompletedAllTime: number
    overallCompletionRate: number
  }
}

// Size the grid to the available card space, including the narrow admin shell.
const metricGridSx = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 1.5,
  minWidth: 0,
}

function formatWeek(week: string) {
  return new Date(week).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

export function AdminAnalytics() {
  const [dashboard, setDashboard] = useState<WeeklyReportData | null>(null)
  const [reports, setReports] = useState<WeeklyReportData[]>([])
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [dashboardRes, reportsRes, summaryRes] = await Promise.all([
        getAnalyticsDashboard(), getAnalyticsReports(1, 10), getAnalyticsSummary(),
      ])
      setDashboard(dashboardRes.report)
      setReports(reportsRes.reports)
      setSummary(summaryRes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  async function handleGenerateReport() {
    setGenerating(true)
    setGenerateError(null)
    try {
      await generateAnalytics()
      setLoading(true)
      setError(null)
      await loadData()
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownloadWeek() {
    setExporting(true)
    setExportError(null)
    try {
      const blob = await getAnalyticsWeeklyExportCsv()
      const stamp = getUtcWeekRange().start.toISOString().slice(0, 10)
      downloadBlob(`walking_meditation_walks_week_${stamp}.csv`, blob)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Could not download this week’s data.')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [loadData])

  return (
    <AdminLayout title="Analytics">
      <Stack spacing={3} sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        {error && <Alert severity="error">{error}</Alert>}
        {loading ? (
          <Stack direction="row" spacing={1.5} role="status" sx={{ py: 3, alignItems: 'center' }}>
            <CircularProgress size={24} aria-label="Loading analytics" />
            <Typography color="text.secondary">Loading analytics…</Typography>
          </Stack>
        ) : (
          <>
            <AnalyticsSection title="This week" id="weekly-metrics-heading">
              {dashboard ? (
                <>
                  <Typography variant="body2" color="text.secondary">
                    Week of {formatWeek(dashboard.week)}
                  </Typography>
                  <Box sx={metricGridSx}>
                    <MetricCard label="Walks" value={dashboard.totalWalks} detail={`${dashboard.completedWalks} completed`} />
                    <MetricCard label="Completion" value={`${dashboard.completionRate.toFixed(1)}%`} detail={`${dashboard.completedWalks} of ${dashboard.totalWalks} walks`} />
                    <MetricCard label="Participants" value={dashboard.activeParticipants} detail={`of ${dashboard.totalParticipants} participants`} />
                    <MetricCard label="Average calm score" value={dashboard.averageCalmScore.toFixed(1)} detail="Post-walk" />
                  </Box>
                </>
              ) : (
                <Alert severity="info">
                  No analytics data yet. Reports are generated every Monday at 00:00 UTC.
                </Alert>
              )}
            </AnalyticsSection>

            <AnalyticsSection title="Weekly reports" id="weekly-reports-heading">
              {reports.length > 0 ? (
                <Stack spacing={1.5}>
                  {reports.map((report) => <WeeklyReportCard key={report._id} report={report} />)}
                </Stack>
              ) : (
                <Alert severity="info">No weekly reports yet.</Alert>
              )}
            </AnalyticsSection>

            {summary && (
              <AnalyticsSection title="All-time stats" id="summary-heading">
                <Box sx={metricGridSx}>
                  <MetricCard label="Weekly reports" value={summary.reports.total} detail={summary.reports.latest ? `Latest: ${formatWeek(summary.reports.latest.week)}` : 'None yet'} />
                  <MetricCard label="Total walks" value={summary.metrics.totalWalksAllTime} detail={`${summary.metrics.totalCompletedAllTime} completed`} />
                  <MetricCard label="Overall completion" value={`${summary.metrics.overallCompletionRate.toFixed(1)}%`} detail="All time" />
                  <MetricCard label="Metrics recorded" value={summary.metrics.participantMetricsRecorded} detail="Participant snapshots" />
                </Box>
              </AnalyticsSection>
            )}
          </>
        )}

        <Stack spacing={1.5}>
          {generateError && <Alert severity="error">{generateError}</Alert>}
          <Button
            onClick={handleGenerateReport}
            disabled={loading || generating}
          >
            {generating ? 'Generating report…' : 'Manual refresh'}
          </Button>
          {exportError && <Alert severity="error">{exportError}</Alert>}
          <Button
            variant="secondary"
            onClick={handleDownloadWeek}
            disabled={exporting || generating}
            className="h-auto! min-h-12 py-3! whitespace-normal"
          >
            {exporting ? 'Preparing download…' : "Download this week's data (CSV)"}
          </Button>
        </Stack>
      </Stack>
    </AdminLayout>
  )
}

function AnalyticsSection({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <Stack component="section" aria-labelledby={id} spacing={1.5} sx={{ minWidth: 0 }}>
      <Typography id={id} component="h2" variant="h6" sx={{ fontWeight: 600 }}>{title}</Typography>
      {children}
    </Stack>
  )
}

function MetricCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <Card variant="outlined" sx={{ minWidth: 0, height: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%', p: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>{label}</Typography>
        <Typography component="p" variant="h5" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 'auto' }}>{detail}</Typography>
      </CardContent>
    </Card>
  )
}

function WeeklyReportCard({ report }: { report: WeeklyReportData }) {
  return (
    <Card variant="outlined" component="article" sx={{ minWidth: 0 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack spacing={2}>
          <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 600 }}>
            Week of {formatWeek(report.week)}
          </Typography>
          <Divider />
          <Box component="dl" sx={{ ...metricGridSx, m: 0 }}>
            <ReportDetail label="Walks" value={`${report.totalWalks} (${report.completedWalks} completed)`} />
            <ReportDetail label="Participants" value={report.activeParticipants} />
            <ReportDetail label="Average calm score" value={report.averageCalmScore.toFixed(1)} />
            <ReportDetail label="Top route" value={report.topRouteType ? report.topRouteType.replace(/[_-]/g, ' ') : 'No route recorded'} />
          </Box>
          <Stack spacing={1}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Completion · {report.completionRate.toFixed(0)}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, Math.max(0, report.completionRate))}
              aria-label={`Walk completion for week of ${formatWeek(report.week)}`}
              sx={{ height: 6, borderRadius: 1 }}
            />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

function ReportDetail({ label, value }: { label: string; value: string | number }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography component="dt" variant="body2" color="text.secondary">{label}</Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, mt: 0.5, fontWeight: 500 }}>{value}</Typography>
    </Box>
  )
}
