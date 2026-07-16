if(NOT TARGET react-native-worklets-core::rnworklets)
add_library(react-native-worklets-core::rnworklets SHARED IMPORTED)
set_target_properties(react-native-worklets-core::rnworklets PROPERTIES
    IMPORTED_LOCATION "/Users/apple/RoughTurf/TurfMobile/mobile/node_modules/react-native-worklets-core/android/build/intermediates/cxx/Debug/1oz2i136/obj/arm64-v8a/librnworklets.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/apple/RoughTurf/TurfMobile/mobile/node_modules/react-native-worklets-core/android/build/headers/rnworklets"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

