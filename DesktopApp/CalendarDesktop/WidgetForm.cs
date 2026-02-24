using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Runtime.InteropServices;

namespace CalendarDesktop;

public class WidgetForm : Form
{
    private readonly WebView2 _webView;
    private const string VirtualHost = "calendar.app";
    private bool _closeHover;

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

    public WidgetForm(string distFolder, Action onFocusMain)
    {
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        TopMost = true;
        Width = 320;
        Height = 500;
        BackColor = Color.FromArgb(10, 10, 10);

        // Bottom-right corner
        var wa = Screen.PrimaryScreen?.WorkingArea ?? new Rectangle(0, 0, 1920, 1080);
        Location = new Point(wa.Right - Width - 16, wa.Bottom - Height - 16);

        // Rounded corners (Win11)
        try { int r = 2; DwmSetWindowAttribute(Handle, 33, ref r, sizeof(int)); } catch { }
        // Dark mode hint
        int dark = 1;
        DwmSetWindowAttribute(Handle, 20, ref dark, sizeof(int));

        // ── Native drag header (sits above WebView2 so it receives real mouse events) ──
        const int HEADER_H = 34;
        var header = new Panel
        {
            Dock = DockStyle.Top,
            Height = HEADER_H,
            BackColor = Color.FromArgb(10, 10, 10),
            Cursor = Cursors.SizeAll,
        };

        header.Paint += (_, e) =>
        {
            e.Graphics.Clear(Color.FromArgb(10, 10, 10));
            using var f = new Font("Consolas", 7.5f);
            e.Graphics.DrawString("⊞  HORIZON", f, new SolidBrush(Color.FromArgb(65, 65, 65)), 10, 10);
            e.Graphics.DrawString(DateTime.Now.ToString("HH:mm"), f, new SolidBrush(Color.FromArgb(45, 45, 45)), header.Width - 85, 10);
            // × close button
            using var cf = new Font("Consolas", 12f);
            var closeColor = _closeHover ? Color.FromArgb(190, 60, 60) : Color.FromArgb(50, 50, 50);
            e.Graphics.DrawString("×", cf, new SolidBrush(closeColor), header.Width - 28, 6);
            // bottom separator line
            e.Graphics.DrawLine(new Pen(Color.FromArgb(20, 20, 20)), 0, HEADER_H - 1, header.Width, HEADER_H - 1);
        };

        // Drag logic — pure WinForms, no WebView2 involvement
        Point dragStart = default;
        bool dragging = false;
        header.MouseDown += (_, e) =>
        {
            if (e.Button != MouseButtons.Left) return;
            if (e.X > header.Width - 34) { Hide(); return; }   // × hit
            dragging = true; dragStart = e.Location; header.Capture = true;
        };
        header.MouseUp += (_, _) => { dragging = false; header.Capture = false; };
        header.MouseMove += (_, e) =>
        {
            if (dragging)
                Location = new Point(Location.X + e.X - dragStart.X, Location.Y + e.Y - dragStart.Y);
            bool wasHover = _closeHover;
            _closeHover = e.X > header.Width - 34;
            header.Cursor = _closeHover ? Cursors.Hand : Cursors.SizeAll;
            if (wasHover != _closeHover) header.Invalidate();
        };
        header.MouseLeave += (_, _) => { _closeHover = false; header.Invalidate(); };

        // Clock tick
        var clock = new System.Windows.Forms.Timer { Interval = 30_000 };
        clock.Tick += (_, _) => header.Invalidate();
        clock.Start();
        FormClosed += (_, _) => clock.Dispose();

        // ── WebView2 fills remaining space ──
        _webView = new WebView2 { Dock = DockStyle.Fill };

        // z-order: WebView2 first (bottom), header second (on top)
        Controls.Add(_webView);
        Controls.Add(header);

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
                    var type = msg.RootElement.GetProperty("type").GetString();
                    if (type == "focusMain") Invoke(onFocusMain);
                }
                catch { }
            };
            _webView.Source = new Uri($"https://{VirtualHost}/index.html#/widget");
        };
    }
}
