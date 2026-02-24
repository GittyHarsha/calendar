using Microsoft.Web.WebView2.WinForms;
using System.Text.Json;

namespace CalendarDesktop;

/// <summary>Reads task data from the WebView's localStorage and fires Windows toast notifications.</summary>
public class NotificationService : IDisposable
{
    private readonly WebView2 _webView;
    private readonly System.Threading.Timer _timer;
    private readonly HashSet<string> _shownToday = new();
    private DateTime _lastShownDate = DateTime.MinValue;
    private bool _morningBriefSent = false;
    private bool _eveningNudgeSent = false;

    public NotificationService(WebView2 webView)
    {
        _webView = webView;
        // Check every 5 minutes
        _timer = new System.Threading.Timer(_ => Check(), null,
            TimeSpan.FromSeconds(30), TimeSpan.FromMinutes(5));
    }

    private void Check()
    {
        var now = DateTime.Now;
        // Quiet hours: 10pm–8am
        if (now.Hour < 8 || now.Hour >= 22) return;

        // Reset daily tracking
        if (_lastShownDate.Date != now.Date)
        {
            _shownToday.Clear();
            _morningBriefSent = false;
            _eveningNudgeSent = false;
            _lastShownDate = now;
        }

        _webView.Invoke(async () =>
        {
            try
            {
                var json = await _webView.CoreWebView2.ExecuteScriptAsync(
                    "localStorage.getItem('horizon-storage')");

                // json is a JSON string (double-encoded)
                var raw = JsonSerializer.Deserialize<string>(json);
                if (string.IsNullOrEmpty(raw)) return;

                var doc = JsonDocument.Parse(raw);
                var state = doc.RootElement.GetProperty("state");
                var tasks = state.GetProperty("tasks");

                var today = DateTime.Today;
                var overdueTasks = new List<string>();
                var todayTasks = new List<string>();
                var incompleteTodayCount = 0;

                foreach (var task in tasks.EnumerateArray())
                {
                    if (task.GetProperty("completed").GetBoolean()) continue;
                    var title = task.GetProperty("title").GetString() ?? "";
                    var id = task.GetProperty("id").GetString() ?? "";

                    string? deadline = null;
                    if (task.TryGetProperty("deadline", out var dl) && dl.ValueKind == JsonValueKind.String)
                        deadline = dl.GetString();

                    string? date = null;
                    if (task.TryGetProperty("date", out var dt) && dt.ValueKind == JsonValueKind.String)
                        date = dt.GetString();

                    if (deadline != null && DateTime.TryParse(deadline, out var deadlineDate))
                    {
                        var diff = (deadlineDate.Date - today).Days;
                        if (diff < 0) overdueTasks.Add(title);
                        else if (diff == 0) todayTasks.Add(title);
                    }

                    if (date != null && DateTime.TryParse(date, out var workDate) && workDate.Date == today)
                        incompleteTodayCount++;
                }

                // Morning brief at 9am
                if (now.Hour == 9 && !_morningBriefSent)
                {
                    _morningBriefSent = true;
                    var parts = new List<string>();
                    if (todayTasks.Count > 0) parts.Add($"{todayTasks.Count} due today");
                    if (overdueTasks.Count > 0) parts.Add($"{overdueTasks.Count} overdue");
                    if (parts.Count > 0)
                        ShowToast("Horizon · Morning Brief", string.Join(" · ", parts));
                    else
                        ShowToast("Horizon", "You're clear for today 👌");
                }

                // Per-task overdue alerts (once per task per day)
                foreach (var task in tasks.EnumerateArray())
                {
                    if (task.GetProperty("completed").GetBoolean()) continue;
                    var id = task.GetProperty("id").GetString() ?? "";
                    var title = task.GetProperty("title").GetString() ?? "";
                    if (_shownToday.Contains(id)) continue;

                    string? deadline = null;
                    if (task.TryGetProperty("deadline", out var dl) && dl.ValueKind == JsonValueKind.String)
                        deadline = dl.GetString();

                    if (deadline != null && DateTime.TryParse(deadline, out var deadlineDate))
                    {
                        var diff = (deadlineDate.Date - today).Days;
                        if (diff < 0)
                        {
                            _shownToday.Add(id);
                            ShowToast("⚠ Overdue", $"{title} — {Math.Abs(diff)}d past deadline");
                        }
                        else if (diff == 0 && now.Hour >= 9)
                        {
                            _shownToday.Add(id);
                            ShowToast("🚩 Due Today", title);
                        }
                    }
                }

                // Evening nudge at 6pm
                if (now.Hour == 18 && !_eveningNudgeSent && incompleteTodayCount > 0)
                {
                    _eveningNudgeSent = true;
                    ShowToast("Horizon · Evening", $"{incompleteTodayCount} task{(incompleteTodayCount > 1 ? "s" : "")} still open today");
                }
            }
            catch { /* non-fatal */ }
        });
    }

    private static void ShowToast(string title, string message)
    {
        try
        {
            // Use Windows balloon tip via NotifyIcon as a simple cross-version approach
            // For full toast, would need WinRT interop
            var tray = Application.OpenForms.OfType<MainForm>().FirstOrDefault()?.TrayIcon;
            tray?.ShowBalloonTip(5000, title, message, ToolTipIcon.Info);
        }
        catch { }
    }

    public void Dispose() => _timer.Dispose();
}
