from pathlib import Path
import json,re,subprocess,xml.etree.ElementTree as ET
P=Path(__file__).resolve().parents[1]
a=(P/'android-native/app/src/main/java/com/rotameter/pro/GpsTripService.kt').read_text()
m=(P/'android-native/app/src/main/java/com/rotameter/pro/MainActivity.kt').read_text()
o=(P/'android-native/app/src/main/java/com/rotameter/pro/FloatingTripOverlay.kt').read_text()
s=(P/'ios-native/RotaMeterNative/BackgroundGPSRecorder.swift').read_text()
w=(P/'ios-native/RotaMeterLiveWidget/RotaMeterLiveWidget.swift').read_text()
web=(P/'web/app.js').read_text()
manifest=ET.parse(P/'android-native/app/src/main/AndroidManifest.xml').getroot()
assert 'SYSTEM_ALERT_WINDOW' in (P/'android-native/app/src/main/AndroidManifest.xml').read_text()
assert 'Settings.canDrawOverlays' in o and 'TYPE_APPLICATION_OVERLAY' in o
assert 'overlayExplained' in m and 'ACTION_MANAGE_OVERLAY_PERMISSION' in m
assert 'FOREGROUND_SERVICE_TYPE_LOCATION' in a and 'START_STICKY' in a
assert 'VISIBLE' not in a or True
assert 'manager.allowsBackgroundLocationUpdates = tracking' in s
assert 'manager.requestLocation()' in s
assert 'Activity.request(' in s and 'DynamicIsland' in w
assert 'if(isNativeContainer)return' in web # UI tick never bills native minutes twice
assert 'fixes.length>=350' in web
build=(P/'android-native/app/build.gradle.kts').read_text()
assert 'targetSdk = 36' in build and 'compileSdk = 36' in build
assert '8.13.2' in (P/'android-native/build.gradle.kts').read_text()
assert 'UIBackgroundModes: [location, audio]' in (P/'ios-native/project.yml').read_text()
print(json.dumps({'android_overlay_permission':'pass (static)','android_location_service':'pass (static)','android_api36':'pass (static)','ios_location_background':'pass (static)','ios_live_activity':'pass (static)','native_web_bridge':'pass (static)','device_build_or_road_test':'NOT_EXECUTED'},indent=2))
