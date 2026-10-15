package cl.forma.weightexercise;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Basic sender's bounds and private transfer-file identity. No import implementation. */
final class MigrationProtocol {
    static final String BASIC_PACKAGE = "cl.forma.weightexercise.basic";
    static final String PRO_PACKAGE = "cl.forma.weightexercise";
    static final String ACTIVITY = "cl.forma.weightexercise.MainActivity";
    static final String ACTION = "cl.forma.weightexercise.IMPORT_BASIC";
    static final String MIME = "application/vnd.weightexercise.basic-migration+json";
    static final String AUTHORITY = BASIC_PACKAGE + ".migration";
    static final int MIN_VERSION = 8;
    static final int MAX_BYTES = 4 * 1024 * 1024;
    static final long MAX_AGE_MS = 24L * 60 * 60 * 1000;
    private static final long CLOCK_TOLERANCE_MS = 5L * 60 * 1000;
    private static final Pattern NAME = Pattern.compile("^([0-9]{13})-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.json$");

    private MigrationProtocol() {}

    static boolean validName(String name, long now) {
        if (name == null) return false;
        Matcher match = NAME.matcher(name);
        if (!match.matches()) return false;
        try {
            long createdAt = Long.parseLong(match.group(1));
            return createdAt <= now + CLOCK_TOLERANCE_MS && createdAt >= now - MAX_AGE_MS;
        } catch (NumberFormatException ignored) { return false; }
    }

    static byte[] encode(String payload) throws IOException {
        if (payload == null || payload.isEmpty() || payload.length() > MAX_BYTES) throw new IOException("MIGRATION_INVALID_SIZE");
        byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_BYTES) throw new IOException("MIGRATION_INVALID_SIZE");
        return bytes;
    }

}
