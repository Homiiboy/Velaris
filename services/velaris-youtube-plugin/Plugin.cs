using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Serialization;

namespace Velaris.YouTube;

/// <summary>Jellyfin plugin entry point. Playback integration is not implemented yet.</summary>
public sealed class Plugin : BasePlugin<PluginConfiguration>
{
    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    public static Plugin? Instance { get; private set; }

    public override string Name => "Velaris YouTube";

    public override Guid Id => Guid.Parse("ed22f091-42c2-48e5-9f24-c3c608371fac");

    public override string Description => "YouTube integration groundwork for Velaris and Jellyfin.";
}
