if(NOT TARGET react-native-worklets::worklets)
add_library(react-native-worklets::worklets SHARED IMPORTED)
set_target_properties(react-native-worklets::worklets PROPERTIES
    IMPORTED_LOCATION "/Users/apple/RoughTurf/TurfMobile/mobile/node_modules/react-native-worklets/android/build/intermediates/cxx/RelWithDebInfo/2w26544q/obj/arm64-v8a/libworklets.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/apple/RoughTurf/TurfMobile/mobile/node_modules/react-native-worklets/android/build/prefab-headers/worklets"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

