package cl.forma.weightexercise;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        registerPlugin(HealthStepsPlugin.class);
        super.onCreate(state);
    }
}
