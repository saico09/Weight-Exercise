package cl.forma.weightexercise;

import static org.junit.Assert.*;
import java.io.IOException;
import org.junit.Test;

public class MigrationProtocolTest {
    private static final long NOW = 1792094400000L;
    private static String name(long timestamp) { return timestamp + "-67c4bfa1-4856-4bf2-b202-e6a197aa1090.json"; }

    @Test public void temporaryFilesExpireAndCannotEscapeTheirPrivateDirectory() {
        assertTrue(MigrationProtocol.validName(name(NOW), NOW));
        assertFalse(MigrationProtocol.validName(name(NOW - MigrationProtocol.MAX_AGE_MS - 1), NOW));
        assertFalse(MigrationProtocol.validName(name(NOW + 300001), NOW));
        assertFalse(MigrationProtocol.validName("../" + name(NOW), NOW));
        assertFalse(MigrationProtocol.validName(name(NOW) + ".bak", NOW));
        assertFalse(MigrationProtocol.validName(null, NOW));
    }

    @Test public void transferBoundCountsUtf8Bytes() throws Exception {
        assertEquals(MigrationProtocol.MAX_BYTES, MigrationProtocol.encode("x".repeat(MigrationProtocol.MAX_BYTES)).length);
        assertThrows(IOException.class, () -> MigrationProtocol.encode("á".repeat(MigrationProtocol.MAX_BYTES / 2 + 1)));
        assertThrows(IOException.class, () -> MigrationProtocol.encode(""));
        assertThrows(IOException.class, () -> MigrationProtocol.encode(null));
    }
}
