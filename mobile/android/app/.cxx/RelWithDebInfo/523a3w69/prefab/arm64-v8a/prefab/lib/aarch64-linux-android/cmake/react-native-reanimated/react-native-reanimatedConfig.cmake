if(NOT TARGET react-native-reanimated::reanimated)
add_library(react-native-reanimated::reanimated SHARED IMPORTED)
set_target_properties(react-native-reanimated::reanimated PROPERTIES
    IMPORTED_LOCATION "/Users/apple/RoughTurf/TurfMobile/mobile/node_modules/react-native-reanimated/android/build/intermediates/cxx/RelWithDebInfo/6c244t2a/obj/arm64-v8a/libreanimated.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/apple/RoughTurf/TurfMobile/mobile/node_modules/react-native-reanimated/android/build/prefab-headers/reanimated"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

