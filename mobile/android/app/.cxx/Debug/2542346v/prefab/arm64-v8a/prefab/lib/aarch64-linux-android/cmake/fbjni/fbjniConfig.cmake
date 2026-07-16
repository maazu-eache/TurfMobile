if(NOT TARGET fbjni::fbjni)
add_library(fbjni::fbjni SHARED IMPORTED)
set_target_properties(fbjni::fbjni PROPERTIES
    IMPORTED_LOCATION "/Users/apple/.gradle/caches/9.3.1/transforms/ed58bc8a633de13e3e2325d5f38fa465/transformed/jetified-fbjni-0.7.0/prefab/modules/fbjni/libs/android.arm64-v8a/libfbjni.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/apple/.gradle/caches/9.3.1/transforms/ed58bc8a633de13e3e2325d5f38fa465/transformed/jetified-fbjni-0.7.0/prefab/modules/fbjni/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

