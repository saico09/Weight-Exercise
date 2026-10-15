package cl.forma.weightexercise;

import static org.junit.Assert.*;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.junit.Test;

public class MigrationProtocolTest {
    private static final long NOW = 1792094400000L;
    private static String name(long timestamp) { return timestamp + "-67c4bfa1-4856-4bf2-b202-e6a197aa1090.json"; }

    @Test public void onlyFreshUnambiguousPrivateFileNamesAreAllowed() {
        assertTrue(MigrationProtocol.validName(name(NOW), NOW));
        assertTrue(MigrationProtocol.validName(name(NOW - MigrationProtocol.MAX_AGE_MS), NOW));
        assertFalse(MigrationProtocol.validName(name(NOW - MigrationProtocol.MAX_AGE_MS - 1), NOW));
        assertFalse(MigrationProtocol.validName(name(NOW + 300001), NOW));
        assertFalse(MigrationProtocol.validName("../" + name(NOW), NOW));
        assertFalse(MigrationProtocol.validName("%2e%2e/" + name(NOW), NOW));
        assertFalse(MigrationProtocol.validName(name(NOW) + ".bak", NOW));
        assertFalse(MigrationProtocol.validName(null, NOW));
        assertTrue(MigrationProtocol.validId(name(NOW - MigrationProtocol.MAX_AGE_MS - 1)));
    }

    @Test public void readPreservesUtf8AndNeverAcceptsInvalidEncoding() throws Exception {
        String payload = "{\"message\":\"Tú · Motivación 🏆\"}";
        assertEquals(payload, MigrationProtocol.read(new ByteArrayInputStream(payload.getBytes(StandardCharsets.UTF_8))));
        assertThrows(IOException.class, () -> MigrationProtocol.read(new ByteArrayInputStream(new byte[] {(byte) 0xc3, 0x28})));
        assertThrows(IOException.class, () -> MigrationProtocol.read(new ByteArrayInputStream(new byte[0])));
    }

    @Test public void incomingAndOutgoingLimitCountsBytesRatherThanCharacters() throws Exception {
        byte[] boundary = new byte[MigrationProtocol.MAX_BYTES];
        Arrays.fill(boundary, (byte) 'x');
        assertEquals(MigrationProtocol.MAX_BYTES, MigrationProtocol.read(new ByteArrayInputStream(boundary)).length());
        assertEquals(MigrationProtocol.MAX_BYTES, MigrationProtocol.encode(new String(boundary, StandardCharsets.UTF_8)).length);
        assertThrows(IOException.class, () -> MigrationProtocol.read(new ByteArrayInputStream(new byte[MigrationProtocol.MAX_BYTES + 1])));
        assertThrows(IOException.class, () -> MigrationProtocol.encode("á".repeat(MigrationProtocol.MAX_BYTES / 2 + 1)));
        assertThrows(IOException.class, () -> MigrationProtocol.encode(""));
        assertThrows(IOException.class, () -> MigrationProtocol.encode(null));
    }
}
