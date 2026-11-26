"""Pure playback selection regression tests; does not need a live Chromecast."""
import importlib.util
from pathlib import Path
import sys
import types
import unittest

sys.modules.setdefault("pychromecast", types.ModuleType("pychromecast"))
spec = importlib.util.spec_from_file_location(
    "velaris_cast_server", Path(__file__).with_name("server.py")
)
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)
bridge.JELLYFIN_LOCAL = "http://127.0.0.1:8097"
bridge.JELLYFIN_CAST = "http://192.168.0.74:8097"
ITEM = "a" * 32
TOKEN = "test-secret-do-not-log"


class CastPlaybackTests(unittest.TestCase):
    def test_mp4_direct_when_cast_codec_supported(self):
        info = {"MediaSources": [{
            "Id": "source-1", "Container": "mp4", "SupportsDirectPlay": True,
            "MediaStreams": [
                {"Type": "Video", "Codec": "h264"},
                {"Type": "Audio", "Codec": "aac"},
            ],
        }]}
        url, mime, mode = bridge.cast_media_source(ITEM, TOKEN, info)
        self.assertEqual(mime, "video/mp4")
        self.assertIn("MediaSourceId=source-1", url)
        self.assertIn("Static=true", url)
        self.assertIn("api_key=" + TOKEN, url)
        self.assertIn("Direct Play", mode)

    def test_unsupported_codec_uses_negotiated_hls(self):
        info = {"MediaSources": [{
            "Id": "source-2", "Container": "mkv",
            "TranscodingUrl": "/Videos/" + ITEM +
                "/master.m3u8?MediaSourceId=source-2&PlaySessionId=ps-1",
            "MediaStreams": [{"Type": "Video", "Codec": "hevc"}],
        }]}
        url, mime, mode = bridge.cast_media_source(ITEM, TOKEN, info)
        self.assertEqual(mime, "application/vnd.apple.mpegurl")
        self.assertTrue(url.startswith(bridge.JELLYFIN_CAST))
        self.assertIn("MediaSourceId=source-2", url)
        self.assertIn("PlaySessionId=ps-1", url)
        self.assertIn("api_key=" + TOKEN, url)
        self.assertIn("HLS", mode)

    def test_hls_fallback_carries_source_and_session(self):
        info = {"MediaSources": [{"Id": "xyz", "Container": "mkv"}],
                "PlaySessionId": "session-1"}
        url, mime, _ = bridge.cast_media_source(ITEM, TOKEN, info)
        self.assertEqual(mime, "application/vnd.apple.mpegurl")
        self.assertIn("MediaSourceId=xyz", url)
        self.assertIn("PlaySessionId=session-1", url)
        self.assertIn("TranscodingContainer=ts", url)

    def test_external_stream_never_receives_token(self):
        info = {"MediaSources": [{
            "Container": "mkv",
            "TranscodingUrl": "https://external.example.invalid/master.m3u8"
        }]}
        with self.assertRaises(RuntimeError):
            bridge.cast_media_source(ITEM, TOKEN, info)

    def test_disallowed_transcoding_fails_explicitly(self):
        info = {"MediaSources": [{
            "Container": "mkv", "SupportsTranscoding": False
        }]}
        with self.assertRaisesRegex(RuntimeError, "kein Transcoding"):
            bridge.cast_media_source(ITEM, TOKEN, info)


if __name__ == "__main__":
    unittest.main()
