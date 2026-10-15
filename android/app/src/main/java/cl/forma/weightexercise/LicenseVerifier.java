package cl.forma.weightexercise;

import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.LinkedHashMap;
import java.util.Map;

/** Pure verifier shared by the native gate and JVM security tests. Never trusts JS claims. */
final class LicenseVerifier {
    static final long MAX_DURATION_SECONDS = 7 * 24 * 60 * 60;
    static final long CLOCK_TOLERANCE_MS = 5 * 60 * 1000;
    private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    static final class Verified {
        final String accountId;
        final long issuedAt;
        final long expiresAt;
        final String requestHash;
        final String proofNonce;
        Verified(String accountId, long issuedAt, long expiresAt, String requestHash, String proofNonce) {
            this.accountId = accountId; this.issuedAt = issuedAt; this.expiresAt = expiresAt; this.requestHash = requestHash; this.proofNonce = proofNonce;
        }
    }

    static final class Invalid extends Exception {
        Invalid(String code) { super(code); }
    }

    static PublicKey publicKey(String encoded) throws Exception {
        String normalized = encoded.replace("-----BEGIN PUBLIC KEY-----", "").replace("-----END PUBLIC KEY-----", "").replaceAll("\\s", "");
        PublicKey key = KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(decode(normalized.replace('+', '-').replace('/', '_').replaceAll("=+$", ""))));
        if (!(key instanceof RSAPublicKey) || ((RSAPublicKey) key).getModulus().bitLength() < 2048) throw new Invalid("LICENSE_KEY_INVALID");
        return key;
    }

    static Verified verify(String ticket, PublicKey key, String deviceKeyHash, long nowMs) throws Invalid {
        try {
            if (ticket == null || ticket.length() > 8192) throw new Invalid("LICENSE_INVALID");
            String[] parts = ticket.split("\\.", -1);
            if (parts.length != 3) throw new Invalid("LICENSE_INVALID");
            JSONObject header = new JSONObject(new String(decode(parts[0]), StandardCharsets.UTF_8));
            if (!"RS256".equals(header.opt("alg")) || header.has("crit") || header.has("b64") || header.has("jku") || header.has("jwk") || header.has("x5u")) throw new Invalid("LICENSE_ALGORITHM_INVALID");
            Signature verifier = Signature.getInstance("SHA256withRSA");
            verifier.initVerify(key);
            verifier.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
            if (!verifier.verify(decode(parts[2]))) throw new Invalid("LICENSE_SIGNATURE_INVALID");
            JSONObject claims = new JSONObject(new String(decode(parts[1]), StandardCharsets.UTF_8));
            if (!"weight-exercise".equals(claims.opt("iss")) || !"cl.forma.weightexercise".equals(claims.opt("aud")) || !"pro".equals(claims.opt("plan")) || integer(claims, "v") != 1) throw new Invalid("LICENSE_CLAIMS_INVALID");
            Object subject = claims.opt("sub");
            if (!(subject instanceof String) || !((String) subject).matches("(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")) throw new Invalid("LICENSE_ACCOUNT_INVALID");
            if (deviceKeyHash == null || !deviceKeyHash.matches("[A-Za-z0-9_-]{43}") || !deviceKeyHash.equals(claims.opt("deviceKeyHash"))) throw new Invalid("LICENSE_DEVICE_MISMATCH");
            long issuedAt = integer(claims, "iat");
            long expiresAt = integer(claims, "exp");
            if (issuedAt <= 0 || issuedAt > 10_000_000_000L || expiresAt <= issuedAt || expiresAt - issuedAt > MAX_DURATION_SECONDS) throw new Invalid("LICENSE_LIFETIME_INVALID");
            if (issuedAt * 1000L > nowMs + CLOCK_TOLERANCE_MS) throw new Invalid("LICENSE_NOT_YET_VALID");
            if (expiresAt * 1000L <= nowMs) throw new Invalid("LICENSE_EXPIRED");
            Object requestHash = claims.opt("requestHash");
            if (requestHash != null && (!(requestHash instanceof String) || !((String) requestHash).matches("[A-Za-z0-9_-]{43}"))) throw new Invalid("LICENSE_CLAIMS_INVALID");
            Object proofNonce = claims.opt("proofNonce");
            if (proofNonce != null && (!(proofNonce instanceof String) || !((String) proofNonce).matches("[A-Za-z0-9_-]{43}"))) throw new Invalid("LICENSE_CLAIMS_INVALID");
            return new Verified((String) subject, issuedAt * 1000L, expiresAt * 1000L, (String) requestHash, (String) proofNonce);
        } catch (Invalid error) { throw error; }
        catch (Exception error) { throw new Invalid("LICENSE_INVALID"); }
    }

    private static long integer(JSONObject object, String field) throws Invalid {
        Object value = object.opt(field);
        if (!(value instanceof Integer) && !(value instanceof Long)) throw new Invalid("LICENSE_CLAIMS_INVALID");
        return ((Number) value).longValue();
    }

    /** Retains a monotonic lower bound across process restarts and a wall-clock bound across boots. */
    static long checkedTime(long wall, long elapsed, int boot, long lastWall, long anchorWall, long anchorElapsed, int anchorBoot) throws Invalid {
        if (wall <= 0 || elapsed < 0) throw new Invalid("LICENSE_CLOCK_INVALID");
        long expected = lastWall;
        if (boot >= 0 && boot == anchorBoot && anchorWall > 0 && elapsed >= anchorElapsed) {
            expected = Math.max(expected, anchorWall + elapsed - anchorElapsed);
        }
        if (expected - wall > CLOCK_TOLERANCE_MS) throw new Invalid("LICENSE_CLOCK_ROLLBACK");
        return Math.max(wall, expected);
    }

    static final class Clock {
        final long lastWall, anchorWall, anchorElapsed;
        final int anchorBoot;
        Clock(long lastWall, long anchorWall, long anchorElapsed, int anchorBoot) {
            this.lastWall = lastWall; this.anchorWall = anchorWall; this.anchorElapsed = anchorElapsed; this.anchorBoot = anchorBoot;
        }
        Clock advance(long wall, long elapsed, int boot) throws Invalid {
            long effective = checkedTime(wall, elapsed, boot, lastWall, anchorWall, anchorElapsed, anchorBoot);
            // Start a fresh monotonic anchor after every reboot, retaining the old lower bound.
            return anchorBoot != boot || anchorWall == 0
                ? new Clock(effective, effective, elapsed, boot)
                : new Clock(effective, anchorWall, anchorElapsed, anchorBoot);
        }
    }

    /** Short-lived, process-local native nonces; requesting an old hash never revives an old ticket. */
    static final class Proofs {
        private final Map<String, Proof> values = new LinkedHashMap<>();
        private static final class Proof {
            final String hash;
            final long elapsed;
            Proof(String hash, long elapsed) { this.hash = hash; this.elapsed = elapsed; }
        }
        synchronized void remember(String hash, String nonce, long elapsed) {
            values.put(nonce, new Proof(hash, elapsed));
            while (values.size() > 5) values.remove(values.keySet().iterator().next());
        }
        synchronized boolean has(String hash, String nonce, long elapsed) {
            Proof proof = nonce == null ? null : values.get(nonce);
            long age = proof == null ? -1 : elapsed - proof.elapsed;
            return proof != null && proof.hash.equals(hash) && age >= 0 && age <= 120_000;
        }
        synchronized void forget(String nonce) { values.remove(nonce); }
        synchronized void clear() { values.clear(); }
    }

    // Kept platform-independent for API 24 and JVM tests; canonical unpadded base64url only.
    static String encode(byte[] bytes) {
        StringBuilder encoded = new StringBuilder((bytes.length * 4 + 2) / 3);
        int buffer = 0, bits = 0;
        for (byte value : bytes) {
            buffer = (buffer << 8) | (value & 255); bits += 8;
            while (bits >= 6) { bits -= 6; encoded.append(ALPHABET.charAt((buffer >>> bits) & 63)); }
        }
        if (bits > 0) encoded.append(ALPHABET.charAt((buffer << (6 - bits)) & 63));
        return encoded.toString();
    }

    static byte[] decode(String value) throws Invalid {
        if (value.isEmpty() || value.length() % 4 == 1) throw new Invalid("LICENSE_ENCODING_INVALID");
        byte[] decoded = new byte[value.length() * 6 / 8];
        int buffer = 0, bits = 0, offset = 0;
        for (int i = 0; i < value.length(); i++) {
            int digit = ALPHABET.indexOf(value.charAt(i));
            if (digit < 0) throw new Invalid("LICENSE_ENCODING_INVALID");
            buffer = (buffer << 6) | digit; bits += 6;
            if (bits >= 8) { bits -= 8; decoded[offset++] = (byte) (buffer >>> bits); }
        }
        if (!encode(decoded).equals(value)) throw new Invalid("LICENSE_ENCODING_INVALID");
        return decoded;
    }
}
