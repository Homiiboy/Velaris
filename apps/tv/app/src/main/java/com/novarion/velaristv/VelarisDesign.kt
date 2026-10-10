package com.novarion.velaristv

import android.content.Context
import android.graphics.Color
import org.json.JSONObject

/** One design contract shared with Expo, embedded from packages/velaris-design. */
object VelarisDesign {
    private var config = JSONObject()

    fun load(context: Context) {
        config = try {
            JSONObject(context.assets.open("brand.json").bufferedReader().use { it.readText() })
        } catch (_: Exception) { JSONObject() }
    }

    fun color(key: String, fallback: Int): Int = try {
        Color.parseColor(config.optJSONObject("theme")?.optString(key).orEmpty())
    } catch (_: Exception) { fallback }

    fun navigation(key: String, fallback: String): String =
        config.optJSONObject("navigation")?.optString(key, fallback) ?: fallback

    fun homeRow(key: String, fallback: String): String =
        config.optJSONObject("homeRows")?.optString(key, fallback) ?: fallback

    fun maxProfiles(): Int =
        config.optJSONObject("profiles")?.optInt("maxProfiles", 5)?.coerceIn(1, 10) ?: 5
}
