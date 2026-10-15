package cl.forma.weightexercise;

import android.content.ClipData;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Basic sender only. It cannot read Pro data or unlock any Pro functionality. */
@CapacitorPlugin(name = "BasicMigration")
public class BasicMigrationPlugin extends Plugin {
    private final ExecutorService io = Executors.newSingleThreadExecutor();

    private String proStatus() {
        PackageManager manager = getContext().getPackageManager();
        try {
            PackageInfo info = manager.getPackageInfo(MigrationProtocol.PRO_PACKAGE, 0);
            if (manager.checkSignatures(getContext().getPackageName(), MigrationProtocol.PRO_PACKAGE) != PackageManager.SIGNATURE_MATCH) return "signature";
            long version = Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
            return version < MigrationProtocol.MIN_VERSION ? "outdated" : null;
        } catch (PackageManager.NameNotFoundException ignored) { return "missing"; }
    }

    @PluginMethod public void getStatus(PluginCall call) {
        String reason = proStatus();
        JSObject result = new JSObject();
        result.put("available", reason == null);
        if (reason != null) result.put("reason", reason);
        call.resolve(result);
    }

    private File directory() throws IOException {
        File path = new File(getContext().getCacheDir(), "basic-to-pro");
        if (!path.isDirectory() && !path.mkdirs()) throw new IOException("MIGRATION_STORAGE_FAILED");
        return path;
    }

    private void cleanExpired(File directory) throws IOException {
        File[] files = directory.listFiles();
        int valid = 0;
        if (files != null) for (File file : files) {
            if (!MigrationProtocol.validName(file.getName(), System.currentTimeMillis())) {
                Uri uri = FileProvider.getUriForFile(getContext(), MigrationProtocol.AUTHORITY, file);
                getContext().revokeUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                file.delete();
            } else valid++;
        }
        // Repeated taps must not accumulate an unbounded private cache.
        if (valid >= 16) throw new IOException("MIGRATION_BUSY");
    }

    @PluginMethod public void send(PluginCall call) {
        String reason = proStatus();
        if (reason != null) { call.reject("MIGRATION_" + reason.toUpperCase(java.util.Locale.ROOT)); return; }
        String payload = call.getString("payload");
        io.execute(() -> {
            File file = null;
            try {
                byte[] bytes = MigrationProtocol.encode(payload);
                File directory = directory();
                cleanExpired(directory);
                file = new File(directory, System.currentTimeMillis() + "-" + UUID.randomUUID() + ".json");
                try (FileOutputStream output = new FileOutputStream(file)) { output.write(bytes); }
                Uri uri = FileProvider.getUriForFile(getContext(), MigrationProtocol.AUTHORITY, file);
                File transferFile = file;
                getActivity().runOnUiThread(() -> {
                    try {
                        String latest = proStatus();
                        if (latest != null) {
                            transferFile.delete();
                            call.reject("MIGRATION_" + latest.toUpperCase(java.util.Locale.ROOT));
                            return;
                        }
                        Intent intent = new Intent(MigrationProtocol.ACTION);
                        intent.setComponent(new ComponentName(MigrationProtocol.PRO_PACKAGE, MigrationProtocol.ACTIVITY));
                        intent.setDataAndType(uri, MigrationProtocol.MIME);
                        intent.setClipData(ClipData.newUri(getContext().getContentResolver(), "Weight&Exercise Basic", uri));
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                        // Explicit recipient: no chooser, shared storage, or broad provider access.
                        getContext().startActivity(intent);
                        call.resolve();
                    } catch (Exception ignored) {
                        transferFile.delete();
                        call.reject("MIGRATION_OPEN_FAILED");
                    }
                });
            } catch (IOException error) {
                if (file != null) file.delete();
                String code = error.getMessage();
                call.reject("MIGRATION_INVALID_SIZE".equals(code) || "MIGRATION_BUSY".equals(code) ? code : "MIGRATION_STORAGE_FAILED");
            } catch (Exception ignored) {
                if (file != null) file.delete();
                call.reject("MIGRATION_SEND_FAILED");
            }
        });
    }

    @Override protected void handleOnDestroy() { io.shutdown(); }
}
