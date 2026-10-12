package com.novarion.velaristv

import android.content.Context
import android.graphics.Color
import org.json.JSONObject

/** One design contract shared with Expo, embedded from packages/velaris-design. */
object VelarisDesign {
    private var config = JSONObject()
    private var accentOverride: Int? = null

    // Only accent elements change: backdrops and dark gradients stay intact.
    val accents = linkedMapOf(
        "purple" to ("Violett" to "#7C5CFC"),
        "green" to ("Grün" to "#35C97A"),
        "yellow" to ("Gelb" to "#F3C94E"),
        "red" to ("Rot" to "#EE525C"),
        "orange" to ("Orange" to "#FA923C"),
        "blue" to ("Blau" to "#399FFF")
    )

    fun selectedAccent(context: Context): String =
        context.getSharedPreferences("velaris_tv",Context.MODE_PRIVATE)
            .getString("ui_accent","purple")?.takeIf { accents.containsKey(it) } ?: "purple"

    fun setAccent(context: Context, key: String) {
        if (!accents.containsKey(key)) return
        context.getSharedPreferences("velaris_tv",Context.MODE_PRIVATE)
            .edit().putString("ui_accent",key).apply()
        accentOverride = Color.parseColor(accents.getValue(key).second)
    }


    fun load(context: Context) {
        config = try {
            JSONObject(context.assets.open("brand.json").bufferedReader().use { it.readText() })
        } catch (_: Exception) { JSONObject() }
        accentOverride = Color.parseColor(accents.getValue(selectedAccent(context)).second)
    }

    fun color(key: String, fallback: Int): Int = if (key == "accent" || key == "focus" || key == "accentPressed") {
        accentOverride ?: fallback
    } else try {
        Color.parseColor(config.optJSONObject("theme")?.optString(key).orEmpty())
    } catch (_: Exception) { fallback }

    fun navigation(key: String, fallback: String): String =
        config.optJSONObject("navigation")?.optString(key, fallback) ?: fallback

    fun homeRow(key: String, fallback: String): String =
        config.optJSONObject("homeRows")?.optString(key, fallback) ?: fallback

    fun themeText(key: String, fallback: String): String =
        config.optJSONObject("theme")?.optString(key, fallback) ?: fallback

    fun defaultServerUrl(): String =
        config.optString("defaultServerUrl","http://192.168.0.74:8097")

    fun maxProfiles(): Int =
        config.optJSONObject("profiles")?.optInt("maxProfiles", 5)?.coerceIn(1, 10) ?: 5
}
