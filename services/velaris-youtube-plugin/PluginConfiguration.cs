using MediaBrowser.Model.Plugins;

namespace Velaris.YouTube;

public sealed class PluginConfiguration : BasePluginConfiguration
{
    public string SidecarBaseUrl { get; set; } = "http://velaris-youtube-sidecar:8787";

    // Configured on the Jellyfin server only; never send to Velaris clients.
    public string SidecarApiToken { get; set; } = string.Empty;

    public bool EnableDownloads { get; set; } = false;

    public string ArchiveLibraryPath { get; set; } = "/media/youtube";
}
