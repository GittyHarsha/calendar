using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System.Runtime.InteropServices;

namespace CalendarDesktop;

public class MainForm : Form
{
    private readonly WebView2 _webView;
    private CoreWebView2Environment? _sharedEnv;
    private WidgetForm? _widget;
    private NotificationService? _notifService;
    public NotifyIcon TrayIcon { get; private set; }

    private const string VirtualHost = "calendar.app";

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);
    private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;

    public MainForm()
    {
        Text = "Horizon";
        MinimumSize = new Size(900, 600);
        StartPosition = FormStartPosition.CenterScreen;
        WindowState = FormWindowState.Maximized;

        // App icon
        Icon? appIcon = null;
        try {
            string icoPath = Path.Combine(AppContext.BaseDirectory, "app.ico");
            if (File.Exists(icoPath)) appIcon = new Icon(icoPath);
            if (appIcon != null) Icon = appIcon;
        } catch { }

        _webView = new WebView2 { Dock = DockStyle.Fill };
        Controls.Add(_webView);

        // System tray
        TrayIcon = new NotifyIcon
        {
            Icon = appIcon ?? SystemIcons.Application,
            Text = "Horizon",
            Visible = true,
        };
        var trayMenu = new ContextMenuStrip();
        trayMenu.Items.Add("Open Horizon", null, (_, _) => { Show(); Activate(); WindowState = FormWindowState.Maximized; });
        trayMenu.Items.Add("Toggle Widget", null, (_, _) => ToggleWidget());
        trayMenu.Items.Add(new ToolStripSeparator());
        trayMenu.Items.Add("Exit", null, (_, _) => { TrayIcon.Visible = false; Application.Exit(); });
        TrayIcon.ContextMenuStrip = trayMenu;
        TrayIcon.DoubleClick += (_, _) => { Show(); Activate(); WindowState = FormWindowState.Maximized; };

        // Ctrl+W toggles widget
        KeyPreview = true;
        KeyDown += (_, e) => { if (e.Control && e.KeyCode == Keys.W) ToggleWidget(); };

        Load += OnLoad;
        FormClosing += (_, e) => { e.Cancel = true; Hide(); }; // Close to tray
        HandleCreated += (_, _) => EnableDarkTitleBar();
    }

    private void EnableDarkTitleBar()
    {
        int dark = 1;
        DwmSetWindowAttribute(Handle, DWMWA_USE_IMMERSIVE_DARK_MODE, ref dark, sizeof(int));
    }

    private async void OnLoad(object? sender, EventArgs e)
    {
        try
        {
            _sharedEnv = await CoreWebView2Environment.CreateAsync(null, Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "CalendarDesktop", "WebView2"));

            await _webView.EnsureCoreWebView2Async(_sharedEnv);

            _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            _webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
            _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;

            string distFolder = ResolveDist();
            _webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                VirtualHost, distFolder, CoreWebView2HostResourceAccessKind.Allow);

            _webView.Source = new Uri($"https://{VirtualHost}/index.html");

            // Start notification service
            _notifService = new NotificationService(_webView);

            // Auto-show widget on startup
            ShowWidget();
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Startup error:\n\n{ex.Message}", "Horizon", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void ShowWidget()
    {
        if (_widget == null || _widget.IsDisposed)
        {
            _widget = new WidgetForm(_sharedEnv!, () => { Show(); Activate(); WindowState = FormWindowState.Maximized; });
            _widget.Show();
        }
        else _widget.Show();
    }

    private void ToggleWidget()
    {
        if (_widget == null || _widget.IsDisposed) ShowWidget();
        else if (_widget.Visible) _widget.Hide();
        else _widget.Show();
    }

    private static string ResolveDist()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            string candidate = Path.Combine(dir.FullName, "dist", "index.html");
            if (File.Exists(candidate))
                return Path.Combine(dir.FullName, "dist");
            dir = dir.Parent;
        }
        throw new DirectoryNotFoundException(
            "Could not find the 'dist' folder. Run 'npm run build' in the project root first.");
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) { _notifService?.Dispose(); TrayIcon?.Dispose(); }
        base.Dispose(disposing);
    }
}
