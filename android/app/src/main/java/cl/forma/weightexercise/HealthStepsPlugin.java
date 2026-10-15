package cl.forma.weightexercise;

import android.content.Intent;
import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.health.connect.AggregateRecordsRequest;
import android.health.connect.AggregateRecordsResponse;
import android.health.connect.HealthConnectException;
import android.health.connect.HealthConnectManager;
import android.health.connect.TimeInstantRangeFilter;
import android.health.connect.datatypes.StepsRecord;
import android.os.Build;
import android.os.OutcomeReceiver;
import android.os.ext.SdkExtensions;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

/** Read-only Health Connect integration. Never inserts a step or weight record. */
@CapacitorPlugin(name = "HealthSteps", permissions = {
    @Permission(alias = "steps", strings = { "android.permission.health.READ_STEPS" })
})
public class HealthStepsPlugin extends Plugin {
    private boolean available() {
        return Build.VERSION.SDK_INT >= 34 && getContext().getSystemService(HealthConnectManager.class) != null;
    }

    @PluginMethod public void status(PluginCall call) {
        boolean supported = available();
        SensorManager sensors = (SensorManager) getContext().getSystemService(android.content.Context.SENSOR_SERVICE);
        boolean automatic = supported && SdkExtensions.getExtensionVersion(34) >= 20 && sensors != null && sensors.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null;
        JSObject result = new JSObject();
        result.put("available", supported);
        result.put("granted", supported && getPermissionState("steps") == PermissionState.GRANTED);
        result.put("onDeviceCounting", automatic);
        call.resolve(result);
    }

    @PluginMethod public void requestAccess(PluginCall call) {
        if (!available()) { call.reject("HEALTH_UNAVAILABLE"); return; }
        if (getPermissionState("steps") == PermissionState.GRANTED) { status(call); return; }
        requestPermissionForAlias("steps", call, "accessResult");
    }

    @PermissionCallback private void accessResult(PluginCall call) { status(call); }

    @PluginMethod public void openSettings(PluginCall call) {
        if (!available()) { call.reject("HEALTH_UNAVAILABLE"); return; }
        try {
            Intent intent = new Intent("android.health.connect.action.HEALTH_HOME_SETTINGS");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) { call.reject("HEALTH_SETTINGS_UNAVAILABLE"); }
    }

    @PluginMethod public void readDays(PluginCall call) {
        if (!available()) { call.reject("HEALTH_UNAVAILABLE"); return; }
        if (getPermissionState("steps") != PermissionState.GRANTED) { call.reject("HEALTH_PERMISSION_REQUIRED"); return; }
        JSArray raw = call.getArray("dates");
        if (raw == null || raw.length() > 30) { call.reject("INVALID_DATES"); return; }
        List<LocalDate> days = new ArrayList<>();
        LocalDate today = LocalDate.now();
        try {
            for (int i = 0; i < raw.length(); i++) {
                String value = raw.getString(i);
                LocalDate day = LocalDate.parse(value);
                if (!value.equals(day.toString()) || day.isAfter(today) || day.isBefore(today.minusDays(29))) throw new IllegalArgumentException();
                days.add(day);
            }
        } catch (Exception error) { call.reject("INVALID_DATES"); return; }
        readDay(call, new ArrayList<>(new LinkedHashSet<>(days)), 0, new JSArray());
    }

    @android.annotation.TargetApi(34)
    private void readDay(PluginCall call, List<LocalDate> days, int index, JSArray output) {
        if (index >= days.size()) { JSObject result = new JSObject(); result.put("days", output); call.resolve(result); return; }
        LocalDate day = days.get(index);
        ZoneId zone = ZoneId.systemDefault();
        Instant start = day.atStartOfDay(zone).toInstant();
        Instant end = day.plusDays(1).atStartOfDay(zone).toInstant();
        // Calendar boundaries respect 23/25-hour DST days. No origin filter: Health Connect deduplicates sources.
        AggregateRecordsRequest<Long> request = new AggregateRecordsRequest.Builder<Long>(
            new TimeInstantRangeFilter.Builder().setStartTime(start).setEndTime(end).build())
            .addAggregationType(StepsRecord.STEPS_COUNT_TOTAL).build();
        try {
            HealthConnectManager manager = getContext().getSystemService(HealthConnectManager.class);
            if (manager == null) { call.reject("HEALTH_READ_FAILED"); return; }
            manager.aggregate(request, getContext().getMainExecutor(), new OutcomeReceiver<AggregateRecordsResponse<Long>, HealthConnectException>() {
            @Override public void onResult(AggregateRecordsResponse<Long> result) {
                Long count = result.get(StepsRecord.STEPS_COUNT_TOTAL);
                if (count != null && count >= 0 && count <= 200000) {
                    JSObject entry = new JSObject(); entry.put("date", day.toString()); entry.put("steps", count); output.put(entry);
                }
                readDay(call, days, index + 1, output);
            }
            @Override public void onError(HealthConnectException error) { call.reject("HEALTH_READ_FAILED"); }
            });
        } catch (RuntimeException error) {
            // Service restarts can throw synchronously, including during the next day's callback.
            call.reject("HEALTH_READ_FAILED");
        }
    }
}
