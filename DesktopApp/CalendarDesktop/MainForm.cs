using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace CalendarDesktop;

public class MainForm : Form
{
    private readonly WebView2 _webView;
    private const string VirtualHost = "calendar.app";

    public MainForm()
    {
        Text = "Horizon";
        MinimumSize = new Size(900, 600);
        StartPosition = FormStartPosition.CenterScreen;
        WindowState = FormWindowState.Maximized;

        // App icon
        try {
            string icoPath = Path.Combine(AppContext.BaseDirectory, "app.ico");
            if (File.Exists(icoPath))
                Icon = new Icon(icoPath);
        } catch { /* non-fatal */ }

        _webView = new WebView2 { Dock = DockStyle.Fill };
        Controls.Add(_webView);

        Load += OnLoad;
    }

    private async void OnLoad(object? sender, EventArgs e)
    {
        try
        {
            var env = await CoreWebView2Environment.CreateAsync(null, Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "CalendarDesktop", "WebView2"));

            await _webView.EnsureCoreWebView2Async(env);

            _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            _webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
            _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;

            string distFolder = ResolveDist();
            _webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                VirtualHost, distFolder, CoreWebView2HostResourceAccessKind.Allow);

            _webView.Source = new Uri($"https://{VirtualHost}/index.html");
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Startup error:\n\n{ex.Message}", "Horizon", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
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
}
