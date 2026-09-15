package com.runnerapp.app;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Must run before super.onCreate() — this is what makes styles.xml's
        // windowSplashScreenBackground/…AnimatedIcon actually apply on API <31 too (compat
        // behavior); on 31+ the platform shows it anyway, but the call is still recommended.
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
    }
}
