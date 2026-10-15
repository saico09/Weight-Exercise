package cl.forma.weightexercise;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.provider.Settings;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.tasks.Task;
import com.google.android.play.core.integrity.IntegrityManagerFactory;
import com.google.android.play.core.integrity.StandardIntegrityException;
import com.google.android.play.core.integrity.StandardIntegrityManager;
import com.google.android.play.core.integrity.StandardIntegrityManager.StandardIntegrityTokenProvider;
import com.google.android.play.core.integrity.model.StandardIntegrityErrorCode;
import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.SecureRandom;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** Release entitlement gate: Play attestation, device key proof and a server-signed offline lease. */
@CapacitorPlugin(name = "ProLicense")
public class ProLicensePlugin extends Plugin {
    private static final String KEY_ALIAS = "weight-exercise-pro-device-v1";
    private Task<StandardIntegrityTokenProvider> providerTask;
    private long providerProject;
    private PublicKey pinnedKey;
    private final LicenseVerifier.Proofs pendingProofs = new LicenseVerifier.Proofs();

    private SharedPreferences prefs() { return getContext().getSharedPreferences("we-pro-license-v1", Context.MODE_PRIVATE); }

    private synchronized KeyStore keyStore() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (!store.containsAlias(KEY_ALIAS)) {
            KeyPairGenerator generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_RSA, "AndroidKeyStore");
            generator.initialize(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_SIGN | KeyProperties.PURPOSE_VERIFY)
                .setKeySize(2048).setDigests(KeyProperties.DIGEST_SHA256)
                .setSignaturePaddings(KeyProperties.SIGNATURE_PADDING_RSA_PKCS1)
                .setUserAuthenticationRequired(false).build());
            generator.generateKeyPair();
        }
        return store;
    }

    private byte[] devicePublicKey() throws Exception { return keyStore().getCertificate(KEY_ALIAS).getPublicKey().getEncoded(); }
    private String deviceHash() throws Exception { return LicenseVerifier.encode(MessageDigest.getInstance("SHA-256").digest(devicePublicKey())); }

    private synchronized PublicKey verificationKey() throws Exception {
        if (pinnedKey == null) pinnedKey = LicenseVerifier.publicKey(BuildConfig.WE_LICENSE_PUBLIC_KEY);
        return pinnedKey;
    }

    private boolean configured() {
        try { verificationKey(); return true; } catch (Exception error) { return false; }
    }

    private int bootCount() { return Settings.Global.getInt(getContext().getContentResolver(), Settings.Global.BOOT_COUNT, -1); }

    private LicenseVerifier.Clock checkedClock() throws LicenseVerifier.Invalid {
        SharedPreferences stored = prefs();
        return new LicenseVerifier.Clock(stored.getLong("lastWall", 0), stored.getLong("anchorWall", 0),
            stored.getLong("anchorElapsed", 0), stored.getInt("anchorBoot", -1))
            .advance(System.currentTimeMillis(), SystemClock.elapsedRealtime(), bootCount());
    }

    private SharedPreferences.Editor saveClock(SharedPreferences.Editor editor, LicenseVerifier.Clock clock) {
        return editor.putLong("lastWall", clock.lastWall).putLong("anchorWall", clock.anchorWall)
            .putLong("anchorElapsed", clock.anchorElapsed).putInt("anchorBoot", clock.anchorBoot);
    }

    private static String isoDate(long ms) {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date(ms));
    }

    private synchronized JSObject status() {
        JSObject result = new JSObject();
        result.put("mode", BuildConfig.DEBUG ? "development" : "required");
        result.put("configured", configured());
        result.put("valid", false);
        try {
            String hash = deviceHash();
            result.put("deviceKeyHash", hash);
            if (BuildConfig.DEBUG) {
                result.put("valid", true); result.put("reason", "DEVELOPMENT_BUILD"); return result;
            }
            if (!configured()) { result.put("reason", "LICENSE_NOT_CONFIGURED"); return result; }
            String ticket = prefs().getString("ticket", null);
            if (ticket == null) { result.put("reason", "LICENSE_REQUIRED"); return result; }
            LicenseVerifier.Clock clock = checkedClock();
            LicenseVerifier.Verified verified = LicenseVerifier.verify(ticket, verificationKey(), hash, clock.lastWall);
            // Do not poison the saved clock when a mistaken future date already expires the ticket.
            saveClock(prefs().edit(), clock).apply();
            result.put("valid", true);
            result.put("accountId", verified.accountId);
            result.put("expiresAt", isoDate(verified.expiresAt));
        } catch (LicenseVerifier.Invalid error) { result.put("reason", error.getMessage()); }
        catch (Exception error) { result.put("reason", "LICENSE_DEVICE_UNAVAILABLE"); }
        return result;
    }

    @PluginMethod public void getStatus(PluginCall call) { call.resolve(status()); }

    @PluginMethod public void getDevice(PluginCall call) {
        try {
            JSObject result = new JSObject();
            result.put("devicePublicKey", LicenseVerifier.encode(devicePublicKey()));
            result.put("deviceKeyHash", deviceHash());
            call.resolve(result);
        } catch (Exception error) { call.reject("LICENSE_DEVICE_UNAVAILABLE"); }
    }

    private synchronized Task<StandardIntegrityTokenProvider> prepareProvider(long project, boolean refresh) {
        if (refresh || providerTask == null || providerProject != project || (providerTask.isComplete() && !providerTask.isSuccessful())) {
            providerProject = project;
            providerTask = IntegrityManagerFactory.createStandard(getContext()).prepareIntegrityToken(
                StandardIntegrityManager.PrepareIntegrityTokenRequest.builder().setCloudProjectNumber(project).build());
        }
        return providerTask;
    }

    @PluginMethod public void requestProof(PluginCall call) {
        String hash = call.getString("requestHash");
        Object rawProject = call.getData().opt("cloudProjectNumber");
        String projectText = rawProject == null ? "" : rawProject.toString();
        long project;
        try {
            if (hash == null || !hash.matches("[A-Za-z0-9_-]{43}") || LicenseVerifier.decode(hash).length != 32 || !projectText.matches("[1-9][0-9]{0,15}")) throw new IllegalArgumentException();
            project = Long.parseLong(projectText);
            if (project > 9_007_199_254_740_991L) throw new IllegalArgumentException();
        } catch (Exception error) { call.reject("LICENSE_PROOF_ARGUMENTS_INVALID"); return; }
        byte[] random = new byte[32];
        new SecureRandom().nextBytes(random);
        requestProof(call, hash, LicenseVerifier.encode(random), project, false);
    }

    private void requestProof(PluginCall call, String hash, String nonce, long project, boolean retried) {
        try {
            prepareProvider(project, retried).addOnSuccessListener(provider -> provider.request(
                StandardIntegrityManager.StandardIntegrityTokenRequest.builder().setRequestHash(hash).build())
                .addOnSuccessListener(token -> {
                    try {
                        Signature signature = Signature.getInstance("SHA256withRSA");
                        signature.initSign((PrivateKey) keyStore().getKey(KEY_ALIAS, null));
                        signature.update((hash + "\n" + nonce).getBytes(StandardCharsets.UTF_8));
                        JSObject result = new JSObject();
                        result.put("integrityToken", token.token());
                        result.put("deviceSignature", LicenseVerifier.encode(signature.sign()));
                        result.put("proofNonce", nonce);
                        pendingProofs.remember(hash, nonce, SystemClock.elapsedRealtime());
                        call.resolve(result);
                    } catch (Exception error) { call.reject("LICENSE_DEVICE_UNAVAILABLE"); }
                }).addOnFailureListener(error -> {
                    if (!retried && error instanceof StandardIntegrityException && ((StandardIntegrityException) error).getErrorCode() == StandardIntegrityErrorCode.INTEGRITY_TOKEN_PROVIDER_INVALID) {
                        requestProof(call, hash, nonce, project, true);
                    } else { rejectIntegrity(call, error); }
                })).addOnFailureListener(error -> rejectIntegrity(call, error));
        } catch (Exception error) { call.reject("PLAY_INTEGRITY_UNAVAILABLE"); }
    }

    private void rejectIntegrity(PluginCall call, Exception error) {
        String code = error instanceof StandardIntegrityException ? "PLAY_INTEGRITY_" + ((StandardIntegrityException) error).getErrorCode() : "PLAY_INTEGRITY_UNAVAILABLE";
        call.reject(code);
    }

    @PluginMethod public synchronized void setLicense(PluginCall call) {
        try {
            if (!configured()) { call.reject("LICENSE_NOT_CONFIGURED"); return; }
            String ticket = call.getString("ticket");
            long now = System.currentTimeMillis();
            String hash = deviceHash();
            LicenseVerifier.Verified verified = LicenseVerifier.verify(ticket, verificationKey(), hash, now);
            LicenseVerifier.Clock clock;
            if (pendingProofs.has(verified.requestHash, verified.proofNonce, SystemClock.elapsedRealtime())) {
                // A signed response to this process's fresh attestation may recover a corrected clock.
                clock = new LicenseVerifier.Clock(now, now, SystemClock.elapsedRealtime(), bootCount());
            } else {
                // Replaying a valid old ticket cannot reset the time bound or extend its expiry.
                clock = checkedClock();
                LicenseVerifier.verify(ticket, verificationKey(), hash, clock.lastWall);
            }
            if (!saveClock(prefs().edit().putString("ticket", ticket), clock).commit()) { call.reject("LICENSE_STORAGE_FAILED"); return; }
            pendingProofs.forget(verified.proofNonce);
            call.resolve(status());
        } catch (LicenseVerifier.Invalid error) { call.reject(error.getMessage()); }
        catch (Exception error) { call.reject("LICENSE_DEVICE_UNAVAILABLE"); }
    }

    @PluginMethod public synchronized void clearLicense(PluginCall call) {
        // Retain the device key and clock history; signing out must not reset protection.
        if (!prefs().edit().remove("ticket").commit()) { call.reject("LICENSE_STORAGE_FAILED"); return; }
        pendingProofs.clear();
        call.resolve();
    }
}
