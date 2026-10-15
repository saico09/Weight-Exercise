package com.getcapacitor;

import static org.junit.Assert.*;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import org.junit.Test;

/** Guard the packaged policy against changes in Capacitor's native injection order. */
public class ProductionCspTest {
    @Test public void nativeBridgeIsInstalledBeforePolicyAndAppScriptsStayAfterPolicy() throws Exception {
        String html = "<!doctype html><html><head><meta charset=\"UTF-8\" />"
            + "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'self'\" />"
            + "<script type=\"module\" src=\"/assets/app.js\"></script></head><body></body></html>";
        JSInjector injector = new JSInjector("window.nativeBridgeTest = true;", "", "", "", "", "", "");
        String result = new String(injector.getInjectedStream(new ByteArrayInputStream(html.getBytes(StandardCharsets.UTF_8))).readAllBytes(), StandardCharsets.UTF_8);
        int bridge = result.indexOf("window.nativeBridgeTest = true;");
        int policy = result.indexOf("Content-Security-Policy");
        int appScript = result.indexOf("/assets/app.js");
        assertTrue("Capacitor must inject the trusted bridge before the CSP meta tag", bridge > 0 && bridge < policy);
        assertTrue("The policy must constrain all subsequent app scripts", policy < appScript);
        assertFalse(result.contains("unsafe-inline"));
        assertFalse(result.contains("unsafe-eval"));
    }
}
