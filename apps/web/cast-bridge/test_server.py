"""Pure playback selection regression tests; does not need a live Chromecast."""
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

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



class CastDiscoveryLifecycleTests(unittest.TestCase):
    """Regression for stopped Zeroconf loop before /play."""

    def setUp(self):
        bridge.stop_discovery()

    def tearDown(self):
        bridge.stop_discovery()

    def test_keeps_browser_alive_and_reuses_cast_instances(self):
        class FakeCast:
            uuid = "device-uuid"
            name = "Wohnzimmer TV"
            cast_info = types.SimpleNamespace(model_name="Google TV")
            socket_client = types.SimpleNamespace(is_alive=lambda: False)

        class FakeBrowser:
            def __init__(self):
                self.stop_count = 0

            def stop_discovery(self):
                self.stop_count += 1

        browser = FakeBrowser()
        cast = FakeCast()
        calls = []

        def mock_discover(**kwargs):
            calls.append(kwargs)
            self.assertFalse(kwargs["blocking"])
            self.assertIsNotNone(kwargs["callback"])
            kwargs["callback"](cast)
            return browser

        with patch.object(bridge.pychromecast, "get_chromecasts", mock_discover, create=True):
            first = bridge.discover(force=True)
            second = bridge.discover(force=True)
            self.assertEqual(len(calls), 1, "Repeat device listing must reuse browser")
            self.assertEqual(first, second)
            self.assertEqual(first[0]["name"], "Wohnzimmer TV")
            self.assertEqual(browser.stop_count, 0, "Never stop Zeroconf before cast.wait")
            self.assertIs(bridge.device_for("device-uuid", "profile", allow_new=True), cast)

        bridge.stop_discovery()
        self.assertEqual(browser.stop_count, 1, "Stop mDNS when the bridge shuts down")

    def test_browser_callback_tracks_devices_discovered_later(self):
        class FakeBrowser:
            def stop_discovery(self):
                pass

        callbacks = []

        def mock_discover(**kwargs):
            callbacks.append(kwargs["callback"])
            return FakeBrowser()

        with patch.object(bridge.pychromecast, "get_chromecasts", mock_discover, create=True):
            with patch.object(bridge._DISCOVERY_READY, "wait", return_value=False):
                self.assertEqual(bridge.discover(force=True), [])
            cast = types.SimpleNamespace(
                uuid="later-device", name="Schlafzimmer",
                cast_info=types.SimpleNamespace(model_name="Chromecast"),
                socket_client=types.SimpleNamespace(is_alive=lambda: False),
            )
            callbacks[0](cast)
            self.assertEqual(bridge.discover(force=True)[0]["id"], "later-device")


if __name__ == "__main__":
    unittest.main()
