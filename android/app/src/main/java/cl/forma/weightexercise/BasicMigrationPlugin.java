package cl.forma.weightexercise;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ProviderInfo;
import android.net.Uri;
import android.os.Build;
import android.util.AtomicFile;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Pro receiver only. No export API and no automatic writes to the user's records. */
@CapacitorPlugin(name = "BasicMigration")
public class BasicMigrationPlugin extends Plugin {
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private volatile boolean destroyed;
    private static final int MAX_PENDING = 3;
    private static final int MAX_RECEIPTS = 256;

    @Override public void load() {
        // BridgeActivity also delivers the launch Intent through onNewIntent;
        // deduplication is by the Basic-generated private file identity.
        receive(getActivity().getIntent());
    }

    @Override protected void handleOnNewIntent(Intent intent) { receive(intent); }

    private String basicStatus() {
        PackageManager manager = getContext().getPackageManager();
        try {
            PackageInfo info = manager.getPackageInfo(MigrationProtocol.BASIC_PACKAGE, 0);
            if (manager.checkSignatures(getContext().getPackageName(), MigrationProtocol.BASIC_PACKAGE) != PackageManager.SIGNATURE_MATCH) return "SIGNATURE";
            long version = Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
            return version < MigrationProtocol.MIN_VERSION ? "OUTDATED" : null;
        } catch (PackageManager.NameNotFoundException ignored) { return "MISSING"; }
    }

    private File directory() throws IOException {
        File path = new File(getContext().getCacheDir(), "basic-migration-inbox");
        if (!path.isDirectory() && !path.mkdirs()) throw new IOException("MIGRATION_STORAGE_FAILED");
        return path;
    }

    private SharedPreferences receipts() {
        return getContext().getSharedPreferences("basic-migration-receipts", Context.MODE_PRIVATE);
    }

    private Set<String> consumed() {
        Set<String> result = new HashSet<>(receipts().getStringSet("consumed", new HashSet<>()));
        long now = System.currentTimeMillis();
        result.removeIf(value -> !MigrationProtocol.validName(value, now));
        return result;
    }

    private List<File> pendingFiles() throws IOException {
        List<File> result = new ArrayList<>();
        File[] files = directory().listFiles();
        Set<String> seen = consumed();
        long now = System.currentTimeMillis();
        if (files != null) for (File file : files) {
            // Only this plugin's files live in this app-private directory.
            if (!file.getName().endsWith(".json")) continue;
            if (!MigrationProtocol.validName(file.getName(), now) || seen.contains(file.getName()) || file.length() > MigrationProtocol.MAX_BYTES) {
                new AtomicFile(file).delete();
            } else result.add(file);
        }
        result.sort(Comparator.comparingLong(File::lastModified).thenComparing(File::getName));
        return result;
    }

    private JSObject pending() throws IOException {
        List<File> files = pendingFiles();
        if (files.isEmpty()) return null;
        File first = files.get(0);
        try (InputStream input = new FileInputStream(first)) {
            JSObject result = new JSObject();
            result.put("id", first.getName());
            result.put("payload", MigrationProtocol.read(input));
            return result;
        }
    }

    private void announce() throws IOException {
        JSObject snapshot = pending();
        if (snapshot != null && !destroyed) getActivity().runOnUiThread(() -> {
            if (!destroyed) notifyListeners("transferReady", snapshot);
        });
        // Do not retain events in Capacitor: getPending is the durable source,
        // so an acknowledged payload cannot be replayed by a later listener.
    }

    private void receive(Intent intent) {
        if (destroyed || intent == null || !MigrationProtocol.ACTION.equals(intent.getAction()) || !MigrationProtocol.MIME.equals(intent.getType())) return;
        Uri uri = intent.getData();
        if (uri == null || !"content".equals(uri.getScheme()) || !MigrationProtocol.AUTHORITY.equals(uri.getAuthority()) || uri.getQuery() != null || uri.getFragment() != null) return;
        List<String> segments = uri.getPathSegments();
        if (segments.size() != 2 || !"transfer".equals(segments.get(0))) return;
        String id = segments.get(1);
        if (!MigrationProtocol.validName(id, System.currentTimeMillis()) || basicStatus() != null) return;
        ProviderInfo provider = getContext().getPackageManager().resolveContentProvider(MigrationProtocol.AUTHORITY, 0);
        if (provider == null || !MigrationProtocol.BASIC_PACKAGE.equals(provider.packageName) || provider.exported) return;
        io.execute(() -> {
            try {
                // Recheck on the IO thread before touching the provider.
                if (basicStatus() != null || consumed().contains(id)) return;
                List<File> files = pendingFiles();
                for (File file : files) if (id.equals(file.getName())) { announce(); return; }
                if (files.size() >= MAX_PENDING || consumed().size() >= MAX_RECEIPTS) return;
                String payload;
                try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
                    payload = MigrationProtocol.read(input);
                }
                File target = new File(directory(), id);
                AtomicFile stored = new AtomicFile(target);
                FileOutputStream stream = null;
                try {
                    stream = stored.startWrite();
                    stream.write(MigrationProtocol.encode(payload));
                    stored.finishWrite(stream);
                    // Persist receive order, even if the device clock changes:
                    // a later transfer must not replace the preview being reviewed.
                    long lastReceived = files.isEmpty() ? 0 : files.get(files.size() - 1).lastModified();
                    target.setLastModified(Math.max(System.currentTimeMillis(), lastReceived + 1));
                } catch (IOException error) {
                    if (stream != null) stored.failWrite(stream);
                    throw error;
                }
                announce();
            } catch (Exception ignored) {
                // Untrusted/expired intents never mutate app data or log their content.
            }
        });
    }

    @PluginMethod public void getPending(PluginCall call) {
        io.execute(() -> {
            try {
                JSObject result = new JSObject();
                JSObject snapshot = pending();
                result.put("transfer", snapshot == null ? org.json.JSONObject.NULL : snapshot);
                call.resolve(result);
            } catch (IOException ignored) { call.reject("MIGRATION_READ_FAILED"); }
        });
    }

    @PluginMethod public void clearPending(PluginCall call) {
        String id = call.getString("id");
        if (!MigrationProtocol.validId(id)) { call.reject("MIGRATION_INVALID_ID"); return; }
        io.execute(() -> {
            try {
                File matching = null;
                for (File file : pendingFiles()) if (file.getName().equals(id)) matching = file;
                if (matching != null) {
                    Set<String> seen = consumed();
                    seen.add(id);
                    if (!receipts().edit().putStringSet("consumed", seen).commit()) throw new IOException();
                    new AtomicFile(matching).delete();
                }
                call.resolve();
                announce();
            } catch (IOException ignored) { call.reject("MIGRATION_STORAGE_FAILED"); }
        });
    }

    @PluginMethod public void openBasic(PluginCall call) {
        String status = basicStatus();
        if (status != null) { call.reject("MIGRATION_" + status); return; }
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_MAIN);
                intent.setComponent(new ComponentName(MigrationProtocol.BASIC_PACKAGE, MigrationProtocol.ACTIVITY));
                intent.addCategory(Intent.CATEGORY_LAUNCHER);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception ignored) { call.reject("MIGRATION_OPEN_FAILED"); }
        });
    }

    @Override protected void handleOnDestroy() {
        destroyed = true;
        io.shutdown();
    }
}
