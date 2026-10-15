package cl.forma.weightexercise;

import org.json.JSONObject;
import org.junit.BeforeClass;
import org.junit.Test;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.Signature;
import java.util.Base64;
import static org.junit.Assert.*;

public class LicenseVerifierTest {
    private static KeyPair server;
    private static KeyPair other;
    private static String deviceHash;
    private static final long NOW = 1_792_022_400L;
    private static final String ACCOUNT = "8b9354cd-75cd-478b-b7a3-c4bacdb8d490";

    @BeforeClass public static void keys() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        server = generator.generateKeyPair();
        other = generator.generateKeyPair();
        deviceHash = LicenseVerifier.encode(MessageDigest.getInstance("SHA-256").digest(other.getPublic().getEncoded()));
    }

    private JSONObject claims() throws Exception {
        return new JSONObject().put("iss", "weight-exercise").put("aud", "cl.forma.weightexercise").put("sub", ACCOUNT)
            .put("plan", "pro").put("v", 1).put("deviceKeyHash", deviceHash).put("iat", NOW - 60).put("exp", NOW + 3600);
    }

    private String sign(JSONObject header, JSONObject claims) throws Exception {
        String input = LicenseVerifier.encode(header.toString().getBytes(StandardCharsets.UTF_8)) + "." + LicenseVerifier.encode(claims.toString().getBytes(StandardCharsets.UTF_8));
        Signature signature = Signature.getInstance("SHA256withRSA");
        signature.initSign(server.getPrivate());
        signature.update(input.getBytes(StandardCharsets.US_ASCII));
        return input + "." + LicenseVerifier.encode(signature.sign());
    }

    private String ticket(JSONObject claims) throws Exception { return sign(new JSONObject().put("alg", "RS256").put("typ", "JWT"), claims); }
    private void invalid(String ticket, String code) throws Exception {
        try { LicenseVerifier.verify(ticket, server.getPublic(), deviceHash, NOW * 1000); fail("Accepted invalid ticket"); }
        catch (LicenseVerifier.Invalid error) { assertEquals(code, error.getMessage()); }
    }

    @Test public void authenticTicketKeepsAccountAndAbsoluteExpiry() throws Exception {
        LicenseVerifier.Verified result = LicenseVerifier.verify(ticket(claims()), server.getPublic(), deviceHash, NOW * 1000);
        assertEquals(ACCOUNT, result.accountId);
        assertEquals((NOW + 3600) * 1000, result.expiresAt);
        assertEquals((NOW - 60) * 1000, result.issuedAt);
    }

    @Test public void acceptsAtMostSevenDaysWithoutExpiryGrace() throws Exception {
        LicenseVerifier.verify(ticket(claims().put("iat", NOW).put("exp", NOW + LicenseVerifier.MAX_DURATION_SECONDS)), server.getPublic(), deviceHash, NOW * 1000);
        invalid(ticket(claims().put("iat", NOW).put("exp", NOW + LicenseVerifier.MAX_DURATION_SECONDS + 1)), "LICENSE_LIFETIME_INVALID");
        invalid(ticket(claims().put("exp", NOW)), "LICENSE_EXPIRED");
    }

    @Test public void rejectsTamperedClaimsAndDifferentSigningKey() throws Exception {
        String original = ticket(claims());
        String[] parts = original.split("\\.");
        String modified = parts[0] + "." + LicenseVerifier.encode(claims().put("exp", NOW + 7200).toString().getBytes(StandardCharsets.UTF_8)) + "." + parts[2];
        invalid(modified, "LICENSE_SIGNATURE_INVALID");
        try { LicenseVerifier.verify(original, other.getPublic(), deviceHash, NOW * 1000); fail(); }
        catch (LicenseVerifier.Invalid error) { assertEquals("LICENSE_SIGNATURE_INVALID", error.getMessage()); }
    }

    @Test public void rejectsAlgorithmConfusionAndRemoteKeys() throws Exception {
        for (String algorithm : new String[] { "none", "HS256", "PS256", "rs256" }) {
            invalid(sign(new JSONObject().put("alg", algorithm), claims()), "LICENSE_ALGORITHM_INVALID");
        }
        for (String field : new String[] { "crit", "b64", "jku", "jwk", "x5u" }) {
            invalid(sign(new JSONObject().put("alg", "RS256").put(field, "untrusted"), claims()), "LICENSE_ALGORITHM_INVALID");
        }
    }

    @Test public void rejectsWrongIssuerAudiencePlanAndVersion() throws Exception {
        for (String field : new String[] { "iss", "aud", "plan", "v" }) invalid(ticket(claims().put(field, "wrong")), "LICENSE_CLAIMS_INVALID");
        invalid(ticket(claims().put("v", 2)), "LICENSE_CLAIMS_INVALID");
    }

    @Test public void rejectsWrongAccountAndDevice() throws Exception {
        invalid(ticket(claims().put("sub", "8-7-4-b-c")), "LICENSE_ACCOUNT_INVALID");
        invalid(ticket(claims().put("sub", 123)), "LICENSE_ACCOUNT_INVALID");
        invalid(ticket(claims().put("deviceKeyHash", "a".repeat(43))), "LICENSE_DEVICE_MISMATCH");
    }

    @Test public void rejectsMissingAndCoercedClaimTypes() throws Exception {
        for (String field : new String[] { "iat", "exp", "v" }) {
            JSONObject missing = claims(); missing.remove(field);
            invalid(ticket(missing), "LICENSE_CLAIMS_INVALID");
            invalid(ticket(claims().put(field, String.valueOf(NOW))), "LICENSE_CLAIMS_INVALID");
            invalid(ticket(claims().put(field, 1.5)), "LICENSE_CLAIMS_INVALID");
        }
    }

    @Test public void rejectsFutureInvalidAndOverflowLifetimes() throws Exception {
        invalid(ticket(claims().put("iat", NOW + 301).put("exp", NOW + 3600)), "LICENSE_NOT_YET_VALID");
        invalid(ticket(claims().put("exp", NOW - 60)), "LICENSE_LIFETIME_INVALID");
        invalid(ticket(claims().put("iat", Long.MAX_VALUE - 100).put("exp", Long.MAX_VALUE)), "LICENSE_LIFETIME_INVALID");
        invalid(ticket(claims().put("iat", 0)), "LICENSE_LIFETIME_INVALID");
    }

    @Test public void malformedAndOversizedTicketsFailClosed() throws Exception {
        invalid(null, "LICENSE_INVALID"); invalid("a.b.c.d", "LICENSE_INVALID"); invalid("x".repeat(8193), "LICENSE_INVALID");
        invalid("a.b.c", "LICENSE_ENCODING_INVALID");
        invalid("....", "LICENSE_INVALID");
    }

    @Test public void base64MatchesStandardImplementationAndRejectsAmbiguity() throws Exception {
        for (int length = 1; length <= 512; length++) {
            byte[] data = new byte[length];
            for (int i = 0; i < length; i++) data[i] = (byte) (i * 137 + length);
            assertEquals(Base64.getUrlEncoder().withoutPadding().encodeToString(data), LicenseVerifier.encode(data));
            assertArrayEquals(data, LicenseVerifier.decode(LicenseVerifier.encode(data)));
        }
        for (String invalid : new String[] { "", "a", "AA=", "AA==", "AB", "AA\n", "A+", "A/" }) {
            try { LicenseVerifier.decode(invalid); fail(invalid); } catch (LicenseVerifier.Invalid expected) { /* expected */ }
        }
    }

    @Test public void loadsPinnedSpkiOrPemAndRejectsWeakKey() throws Exception {
        String encoded = Base64.getEncoder().encodeToString(server.getPublic().getEncoded());
        assertArrayEquals(server.getPublic().getEncoded(), LicenseVerifier.publicKey(encoded).getEncoded());
        assertArrayEquals(server.getPublic().getEncoded(), LicenseVerifier.publicKey("-----BEGIN PUBLIC KEY-----\n" + encoded + "\n-----END PUBLIC KEY-----").getEncoded());
        KeyPairGenerator weak = KeyPairGenerator.getInstance("RSA"); weak.initialize(1024);
        try { LicenseVerifier.publicKey(Base64.getEncoder().encodeToString(weak.generateKeyPair().getPublic().getEncoded())); fail(); }
        catch (LicenseVerifier.Invalid error) { assertEquals("LICENSE_KEY_INVALID", error.getMessage()); }
    }

    @Test public void monotonicClockPreventsFrozenWallAndRollbackWithinBoot() throws Exception {
        long wall = NOW * 1000;
        assertEquals(wall + 120_000, LicenseVerifier.checkedTime(wall, 121_000, 7, wall, wall, 1000, 7));
        try { LicenseVerifier.checkedTime(wall, 302_000, 7, wall, wall, 1000, 7); fail(); }
        catch (LicenseVerifier.Invalid error) { assertEquals("LICENSE_CLOCK_ROLLBACK", error.getMessage()); }
    }

    @Test public void persistedWallBoundSurvivesRebootAndAllowsNormalPassage() throws Exception {
        long wall = NOW * 1000;
        assertEquals(wall + 1000, LicenseVerifier.checkedTime(wall + 1000, 100, 8, wall, wall, 1000, 7));
        try { LicenseVerifier.checkedTime(wall - 300_001, 100, 8, wall, wall, 1000, 7); fail(); }
        catch (LicenseVerifier.Invalid error) { assertEquals("LICENSE_CLOCK_ROLLBACK", error.getMessage()); }
    }

    @Test public void monotonicEffectiveTimeStillExpiresSignedTicket() throws Exception {
        long effective = LicenseVerifier.checkedTime((NOW + 3590) * 1000, 3_600_000, 7, NOW * 1000, NOW * 1000, 0, 7);
        try { LicenseVerifier.verify(ticket(claims()), server.getPublic(), deviceHash, effective); fail(); }
        catch (LicenseVerifier.Invalid error) { assertEquals("LICENSE_EXPIRED", error.getMessage()); }
    }

    @Test public void rebootRenewsMonotonicAnchorSoFrozenClockCannotPersist() throws Exception {
        long wall = NOW * 1000;
        LicenseVerifier.Clock previousBoot = new LicenseVerifier.Clock(wall, wall, 1_000, 7);
        LicenseVerifier.Clock afterBoot = previousBoot.advance(wall + 10_000, 100, 8);
        assertEquals(8, afterBoot.anchorBoot);
        assertEquals(100, afterBoot.anchorElapsed);
        LicenseVerifier.Clock afterTwoMinutes = afterBoot.advance(wall + 10_000, 120_100, 8);
        assertEquals(wall + 130_000, afterTwoMinutes.lastWall);
        try { afterTwoMinutes.advance(wall + 10_000, 301_100, 8); fail("Frozen clock must need revalidation"); }
        catch (LicenseVerifier.Invalid error) { assertEquals("LICENSE_CLOCK_ROLLBACK", error.getMessage()); }
    }

    @Test public void verifiedRequestHashCanBindClockRecoveryToFreshNativeProof() throws Exception {
        String requestHash = "A".repeat(43);
        assertEquals(requestHash, LicenseVerifier.verify(ticket(claims().put("requestHash", requestHash)), server.getPublic(), deviceHash, NOW * 1000).requestHash);
        invalid(ticket(claims().put("requestHash", "untrusted")), "LICENSE_CLAIMS_INVALID");
        invalid(ticket(claims().put("requestHash", 123)), "LICENSE_CLAIMS_INVALID");
        String proofNonce = "B".repeat(43);
        assertEquals(proofNonce, LicenseVerifier.verify(ticket(claims().put("requestHash", requestHash).put("proofNonce", proofNonce)), server.getPublic(), deviceHash, NOW * 1000).proofNonce);
        invalid(ticket(claims().put("proofNonce", "old")), "LICENSE_CLAIMS_INVALID");
        invalid(ticket(claims().put("proofNonce", true)), "LICENSE_CLAIMS_INVALID");
    }

    @Test public void proofFreshnessRequiresNewNativeNonceWithMatchingHash() {
        LicenseVerifier.Proofs proofs = new LicenseVerifier.Proofs();
        proofs.remember("hash", "native-nonce", 1000);
        assertTrue(proofs.has("hash", "native-nonce", 120_000));
        assertFalse(proofs.has("changed-hash", "native-nonce", 120_000));
        assertFalse(proofs.has("hash", "old-nonce", 120_000));
        assertFalse(proofs.has("hash", "native-nonce", 121_001));
        assertFalse(proofs.has("hash", "native-nonce", 999));
        proofs.forget("native-nonce");
        proofs.remember("hash", "new-native-nonce", 2000);
        assertFalse(proofs.has("hash", "native-nonce", 2100));
        assertTrue(proofs.has("hash", "new-native-nonce", 2100));
        proofs.clear();
        assertFalse(proofs.has("hash", "new-native-nonce", 2100));
    }
}
