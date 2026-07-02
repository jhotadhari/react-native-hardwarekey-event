package com.jhotadhari.reactnative.hardwarekeyevent;

import android.view.KeyEvent;

import androidx.annotation.Nullable;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Static utility that builds bidirectional key-code lookup tables
 * <strong>once</strong> at class-load time by reflecting over
 * {@code android.view.KeyEvent} fields.
 *
 * <p>All public API methods are thread-safe by virtue of reading from
 * unmodifiable collections populated during static initialization.</p>
 */
public final class KeyCodeMapper {

    private static final Map<Integer, String> KEY_CODE_TO_STRING;
    private static final Map<String, Integer> STRING_TO_KEY_CODE;
    private static final List<String> SUPPORTED_KEY_CODES;

    static {
        final Map<Integer, String> codeToString = new HashMap<>();
        final Map<String, Integer> stringToCode = new HashMap<>();
        final List<String> codes = new ArrayList<>();

        for (final Field field : KeyEvent.class.getFields()) {
            final String name = field.getName();
            if (!name.startsWith("KEYCODE_")) {
                continue;
            }
            if (field.getType() != int.class) {
                // Guard against non-int fields that happen to match the prefix
                // (should not occur in practice, but protects against future
                // Android SDK changes).
                continue;
            }
            try {
                final int keyCode = field.getInt(null); // public static int field
                codeToString.put(keyCode, name);
                stringToCode.put(name, keyCode);
                codes.add(name);
            } catch (final IllegalAccessException ignored) {
                // Public fields should always be accessible; skip gracefully
                // if the runtime denies access.
            } catch (final RuntimeException ignored) {
                // Some OEM ROMs aggressively block reflection even on public
                // SDK fields (e.g. via SecurityException).  Skip the field
                // rather than allowing ExceptionInInitializerError to brick
                // the entire module.
            }
        }

        KEY_CODE_TO_STRING = Collections.unmodifiableMap(codeToString);
        STRING_TO_KEY_CODE = Collections.unmodifiableMap(stringToCode);
        SUPPORTED_KEY_CODES = Collections.unmodifiableList(codes);
    }

    /** Non-instantiable utility class. */
    private KeyCodeMapper() {
        throw new AssertionError("No instances");
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * Returns the {@code KEYCODE_*} constant name for the given Android key
     * code integer, or {@code null} when the key code is not recognised.
     *
     * @param keyCode the integer key code from {@link KeyEvent#getKeyCode()}
     * @return the human-readable constant name, or {@code null}
     */
    @Nullable
    public static String getKeyCodeString(final int keyCode) {
        return KEY_CODE_TO_STRING.get(keyCode);
    }

    /**
     * Returns the integer key code for a {@code KEYCODE_*} constant name.
     *
     * @param keyCodeString a key code constant name such as
     *                      {@code "KEYCODE_VOLUME_UP"}
     * @return the integer key code, or {@code -1} when the name is unknown
     */
    public static int getKeyCodeInt(final String keyCodeString) {
        final Integer value = STRING_TO_KEY_CODE.get(keyCodeString);
        return value != null ? value : -1;
    }

    /**
     * Returns an unmodifiable list of every {@code KEYCODE_*} constant
     * name discovered at class-load time.
     *
     * @return ordered list of supported key code constant names
     */
    public static List<String> getSupportedKeyCodes() {
        return SUPPORTED_KEY_CODES;
    }
}
