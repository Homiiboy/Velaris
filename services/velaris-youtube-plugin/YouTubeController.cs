using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Velaris.YouTube;

/// <summary>
/// Authenticated server-side bridge between Jellyfin 10.11 and the private
/// Velaris YouTube sidecar. Requires the current Jellyfin access token.
/// No sidecar API credentials are ever returned to clients.
/// </summary>
[ApiController]
[Authorize]
[Route("VelarisYouTube")]
public sealed class YouTubeController : ControllerBase
{
    private static readonly HttpClient Client = new()
    {
        Timeout = TimeSpan.FromSeconds(90)
    };

    private static readonly Regex VideoIdPattern = new(
        "^[A-Za-z0-9_-]{11}$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static bool TryConfigure(out Uri url, out string token)
    {
        var cfg = Plugin.Instance?.Configuration;
        token = cfg?.SidecarApiToken?.Trim() ?? string.Empty;
        var text = cfg?.SidecarBaseUrl?.TrimEnd('/') ?? string.Empty;
        if (!Uri.TryCreate(text, UriKind.Absolute, out var parsed)
            || parsed.Scheme != Uri.UriSchemeHttp
            || !string.IsNullOrEmpty(parsed.UserInfo)
            || !string.IsNullOrEmpty(parsed.Query)
            || !string.IsNullOrEmpty(parsed.Fragment)
            || string.IsNullOrWhiteSpace(token))
        {
            url = null!;
            return false;
        }

        url = parsed;
        return true;
    }

    private static HttpRequestMessage NewSidecarRequest(Uri baseUrl, string path, string token)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, new Uri(baseUrl, path));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return request;
    }

    /// <summary>Authenticated Jellyfin-to-sidecar health check.</summary>
    [HttpGet("Health")]
    public async Task<IActionResult> Health(CancellationToken cancellationToken)
    {
        if (!TryConfigure(out var baseUrl, out var token))
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { error = "Velaris YouTube sidecar not configured" });
        }

        try
        {
            // Health does not need a token; it is still never a public Jellyfin endpoint.
            using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(baseUrl, "health"));
            using var response = await Client.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return StatusCode(502, new { error = "Sidecar unavailable" });
            }

            return Content(await response.Content.ReadAsStringAsync(cancellationToken), "application/json");
        }
        catch (HttpRequestException)
        {
            return StatusCode(502, new { error = "Sidecar network unavailable" });
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return StatusCode(504, new { error = "Sidecar request timed out" });
        }
    }

    /// <summary>Retrieve YouTube metadata via a protected Jellyfin API route.</summary>
    [HttpGet("Videos/{videoId}")]
    public async Task<IActionResult> Video(string videoId, CancellationToken cancellationToken)
    {
        if (!VideoIdPattern.IsMatch(videoId))
        {
            return BadRequest(new { error = "Invalid YouTube video ID" });
        }

        if (!TryConfigure(out var baseUrl, out var token))
        {
            return StatusCode(503, new { error = "Velaris YouTube sidecar not configured" });
        }

        try
        {
            using var request = NewSidecarRequest(baseUrl, "videos/" + videoId, token);
            using var response = await Client.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return StatusCode(502, new { error = "YouTube metadata unavailable" });
            }

            return Content(await response.Content.ReadAsStringAsync(cancellationToken), "application/json");
        }
        catch (HttpRequestException)
        {
            return StatusCode(502, new { error = "Sidecar network unavailable" });
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return StatusCode(504, new { error = "Sidecar request timed out" });
        }
    }

    /// <summary>
    /// Authenticated streaming probe/transport. HTML5 video elements cannot
    /// attach Jellyfin auth headers; this route is NOT yet a public player URL.
    /// </summary>
    [HttpGet("Videos/{videoId}/Stream")]
    public async Task Stream(string videoId, CancellationToken cancellationToken)
    {
        if (!VideoIdPattern.IsMatch(videoId))
        {
            Response.StatusCode = 400;
            return;
        }

        if (!TryConfigure(out var baseUrl, out var token))
        {
            Response.StatusCode = 503;
            return;
        }

        using var request = NewSidecarRequest(baseUrl, "videos/" + videoId + "/proxy", token);
        if (Request.Headers.TryGetValue("Range", out var range))
        {
            if (!RangeHeaderValue.TryParse(range.ToString(), out var parsed)
                || parsed.Ranges.Count != 1)
            {
                Response.StatusCode = 416;
                return;
            }

            request.Headers.Range = parsed;
        }

        try
        {
            using var upstream = await Client.SendAsync(request,
                HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (upstream.StatusCode != HttpStatusCode.OK
                && upstream.StatusCode != HttpStatusCode.PartialContent)
            {
                Response.StatusCode = upstream.StatusCode == HttpStatusCode.RequestedRangeNotSatisfiable
                    ? 416 : 502;
                return;
            }

            Response.StatusCode = (int)upstream.StatusCode;
            Response.ContentType = upstream.Content.Headers.ContentType?.ToString() ?? "video/mp4";
            if (upstream.Content.Headers.ContentLength is long size)
            {
                Response.ContentLength = size;
            }

            if (upstream.Content.Headers.ContentRange is { } contentRange)
            {
                Response.Headers.ContentRange = contentRange.ToString();
            }

            Response.Headers.AcceptRanges = "bytes";
            Response.Headers.CacheControl = "private, no-store";
            await using var source = await upstream.Content.ReadAsStreamAsync(cancellationToken);
            await source.CopyToAsync(Response.Body, 65536, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Client closed playback or canceled a Range request.
        }
        catch (HttpRequestException)
        {
            if (!Response.HasStarted)
            {
                Response.StatusCode = 502;
            }
        }
        catch (TaskCanceledException)
        {
            if (!Response.HasStarted)
            {
                Response.StatusCode = 504;
            }
        }
    }
}
