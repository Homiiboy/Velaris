using MediaBrowser.Model.Plugins;

namespace Velaris.YouTube;

public sealed class PluginConfiguration : BasePluginConfiguration
{
    public string SidecarBaseUrl { get; set; } = "http://127.0.0.1:8787";

    public bool EnableDownloads { get; set; } = false;

    public string ArchiveLibraryPath { get; set; } = "/media/youtube";
}
