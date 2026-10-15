package cl.forma.weightexercise;

import android.app.Activity;
import android.os.Bundle;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.Locale;

/** Permission rationale accessible from Health Connect before access is granted. */
public class HealthPrivacyActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        boolean english = Locale.getDefault().getLanguage().equals("en");
        TextView text = new TextView(this);
        text.setTextSize(17);
        int padding = (int) (24 * getResources().getDisplayMetrics().density);
        text.setPadding(padding, padding, padding, padding);
        text.setText(english
            ? "Weight&Exercise · Steps privacy\n\nWe request read-only access to daily step totals from Health Connect. We associate them only with dates for which you have already saved a weight record. We never create weight entries automatically or write health data.\n\nSteps are refreshed while the app is open and when you return. Android or your connected tracking app handles counting.\n\nData stays on this device unless you explicitly upload a backup. If you enable email summaries, the account's saved backup is used, including step totals. We do not use health data for advertising.\n\nYou can stop syncing in Settings, revoke access in Health Connect, delete a daily record, or reset local data. Cloud backups and email subscriptions are managed separately under Account and backup."
            : "Weight&Exercise · Privacidad de pasos\n\nPedimos acceso de solo lectura al total diario de pasos de Health Connect. Los asociamos únicamente a fechas en las que ya guardaste un registro de peso. Nunca creamos pesajes automáticamente ni escribimos datos de salud.\n\nLos pasos se actualizan mientras usas la app y al volver a abrirla. Android o tu aplicación de actividad se encargan de contarlos.\n\nLos datos permanecen en este dispositivo salvo que subas un respaldo voluntariamente. Si activas resúmenes por correo, se utiliza el respaldo de tu cuenta, incluidos sus pasos. No usamos datos de salud para publicidad.\n\nPuedes detener la sincronización en Ajustes, revocar el permiso en Health Connect, eliminar un registro o restablecer los datos locales. Los respaldos y suscripciones de correo se administran por separado en Cuenta y respaldo.");
        ScrollView scroll = new ScrollView(this); scroll.addView(text); setContentView(scroll);
    }
}
