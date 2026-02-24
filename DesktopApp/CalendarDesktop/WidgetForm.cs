using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Runtime.InteropServices;

namespace CalendarDesktop;

public class WidgetForm : Form
{
    private readonly WebView2 _webView;
    private const string VirtualHost = "calendar.app";
    private Point _dragStart;
    private bool _dragging;

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);
    private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;

    [DllImport("dwmapi.dll")]
    private static extern int DwmExtendFrameIntoClientArea(IntPtr hwnd, ref MARGINS margins);
    [StructLayout(LayoutKind.Sequential)]
    private struct MARGINS { public int Left, Right, Top, Bottom; }

    public WidgetForm(string distFolder, Action onFocusMain)
    {
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        TopMost = true;
        Width = 320;
        Height = 460;
        BackColor = Color.FromArgb(10, 10, 10);

        // Position bottom-right with margin
        var screen = Screen.PrimaryScreen?.WorkingArea ?? new Rectangle(0, 0, 1920, 1080);
        Location = new Point(screen.Right - Width - 16, screen.Bottom - Height - 16);

        // Rounded corners (Windows 11)
        try
        {
            int radius = 2; // DWMWCP_ROUNDSMALL
            DwmSetWindowAttribute(Handle, 33 /*DWMWA_WINDOW_CORNER_PREFERENCE*/, ref radius, sizeof(int));
        }
        catch { }

        // Dark title bar
        int dark = 1;
        DwmSetWindowAttribute(Handle, DWMWA_USE_IMMERSIVE_DARK_MODE, ref dark, sizeof(int));

        _webView = new WebView2 { Dock = DockStyle.Fill };
        Controls.Add(_webView);

        Load += async (_, _) =>
        {
            var env = await CoreWebView2Environment.CreateAsync(null, MainForm.UserDataFolder);
            await _webView.EnsureCoreWebView2Async(env);
            _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            _webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
            _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            _webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                VirtualHost, distFolder, CoreWebView2HostResourceAccessKind.Allow);
            _webView.CoreWebView2.WebMessageReceived += (_, e) =>
            {
                try
                {
                    var msg = System.Text.Json.JsonDocument.Parse(e.WebMessageAsJson);
                    if (msg.RootElement.GetProperty("type").GetString() == "focusMain")
                        Invoke(onFocusMain);
                }
                catch { }
            };
            _webView.Source = new Uri($"https://{VirtualHost}/index.html#/widget");
        };

        // Drag to move
        _webView.MouseDown += (_, e) => { if (e.Button == MouseButtons.Left) { _dragging = true; _dragStart = e.Location; } };
        _webView.MouseUp += (_, _) => _dragging = false;
        _webView.MouseMove += (_, e) =>
        {
            if (_dragging)
                Location = new Point(Location.X + e.X - _dragStart.X, Location.Y + e.Y - _dragStart.Y);
        };
    }

    // Allow dragging via the WebView content (header area posts "dragStart")
    protected override void WndProc(ref Message m)
    {
        const int WM_NCHITTEST = 0x84;
        const int HTCAPTION = 2;
        if (m.Msg == WM_NCHITTEST)
        {
            base.WndProc(ref m);
            // Allow drag on top 36px (header)
            var pos = PointToClient(new Point(m.LParam.ToInt32() & 0xFFFF, m.LParam.ToInt32() >> 16));
            if (pos.Y < 36) m.Result = (IntPtr)HTCAPTION;
            return;
        }
        base.WndProc(ref m);
    }
}
