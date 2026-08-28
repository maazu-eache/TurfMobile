# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# React Native Core
-keep class com.facebook.react.** { *; }
-keep class com.facebook.react.bridge.Systrace { *; }
-keep class com.facebook.react.devsupport.** { *; }

# Razorpay SDK
-keep class com.razorpay.** { *; }
-dontwarn com.razorpay.**

# React Native Video (ExoPlayer)
-keep class com.brentvatne.react.** { *; }
-dontwarn com.brentvatne.react.**
-keep class com.google.android.exoplayer2.** { *; }
-dontwarn com.google.android.exoplayer2.**

# React Native FastImage (Glide)
-keep class com.dylanvann.fastimage.** { *; }
-dontwarn com.dylanvann.fastimage.**
-keep class com.bumptech.glide.** { *; }
-dontwarn com.bumptech.glide.**

# React Native Reanimated
-keep class com.swmansion.reanimated.** { *; }
-dontwarn com.swmansion.reanimated.**

# React Native SVG
-keep class com.horcrux.svg.** { *; }
-dontwarn com.horcrux.svg.**

# React Native WebView
-keep class com.reactnativecommunity.webview.** { *; }
-dontwarn com.reactnativecommunity.webview.**

# OkHttp/Okio (used for networking)
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**

# Firebase/Google Play Services
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

