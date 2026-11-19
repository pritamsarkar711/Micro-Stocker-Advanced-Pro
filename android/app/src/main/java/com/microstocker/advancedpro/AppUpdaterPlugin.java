package com.microstocker.advancedpro;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * Installs a downloaded update APK from inside the app.
 *
 * Android has no API that installs a package silently for a normal app, so this
 * hands the file to the system package installer with the read permission grant
 * it needs. The dialog the user sees is the operating system's own "update this
 * app?" prompt, which is the Play-compliant way to do an in-app update outside
 * the Play Store.
 *
 * The file must live in the app's own cache or files directory; it reaches the
 * installer through the existing FileProvider.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    @PluginMethod
    public void install(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("No update file was provided.");
            return;
        }
        File file = new File(path);
        if (!file.exists()) {
            call.reject("The downloaded update is missing. Download it again.");
            return;
        }
        try {
            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Android refused to open the installer: " + error.getMessage());
        }
    }

    /** Whether the user has allowed this app to install packages. */
    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject result = new JSObject();
        boolean allowed = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            allowed = getContext().getPackageManager().canRequestPackageInstalls();
        }
        result.put("allowed", allowed);
        call.resolve(result);
    }

    /** Opens the per-app "install unknown apps" switch when it is off. */
    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName())
                );
            } else {
                intent = new Intent(Settings.ACTION_SECURITY_SETTINGS);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not open the install permission screen: " + error.getMessage());
        }
    }

    /** Version code of the running build, so the update check can compare ints. */
    @PluginMethod
    public void getBuild(PluginCall call) {
        JSObject result = new JSObject();
        try {
            android.content.pm.PackageInfo info = getContext().getPackageManager()
                .getPackageInfo(getContext().getPackageName(), 0);
            result.put("versionName", info.versionName);
            result.put("versionCode", Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? info.getLongVersionCode()
                : info.versionCode);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not read the installed version: " + error.getMessage());
        }
    }
}
